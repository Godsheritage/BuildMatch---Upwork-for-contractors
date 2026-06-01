import { useState, useCallback } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import api from '../services/api';
import { useAuth } from './useAuth';

// ── Types ────────────────────────────────────────────────────────────────────

interface UploadResult {
  photoId:  string;
  url:      string;
  areaKey:  string;
}

interface UseEstimatorPhotoUpload {
  uploadPhoto: (params: {
    file:       File;
    propertyId: string;
    areaKey:    string;
    areaLabel:  string;
    caption?:   string;
    sortOrder?: number;
  }) => Promise<UploadResult>;
  deletePhoto: (photoId: string) => Promise<void>;
  uploading:   Record<string, boolean>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const BUCKET    = 'estimate-photos';

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useEstimatorPhotoUpload(): UseEstimatorPhotoUpload {
  const { user } = useAuth();
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const setArea = useCallback(
    (areaKey: string, value: boolean) =>
      setUploading((prev) => ({ ...prev, [areaKey]: value })),
    [],
  );

  // ── uploadPhoto ──────────────────────────────────────────────────────────

  const uploadPhoto = useCallback(
    async (params: {
      file:       File;
      propertyId: string;
      areaKey:    string;
      areaLabel:  string;
      caption?:   string;
      sortOrder?: number;
    }): Promise<UploadResult> => {
      const { file, propertyId, areaKey, areaLabel, caption, sortOrder } = params;

      // 1. Validate file
      if (!ALLOWED_TYPES.has(file.type)) {
        throw new Error(
          'Only JPG, PNG, WEBP, HEIC, or HEIF images are allowed.',
        );
      }
      if (file.size > MAX_BYTES) {
        throw new Error(
          'Image is too large. The maximum size is 15 MB.',
        );
      }
      if (!user) {
        throw new Error('You must be signed in to upload photos.');
      }

      // 2. Generate storage path
      const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${propertyId}/${areaKey}/${Date.now()}.${ext}`;

      // 3. Mark area as uploading
      setArea(areaKey, true);

      try {
        // 4. Upload to Supabase Storage
        const supabase = getSupabaseClient();
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            upsert:      false,
            contentType: file.type || 'image/jpeg',
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        // 5. Get public URL
        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        // 6. Save metadata to backend
        const response = await api.post<{
          success: boolean;
          data: { id: string };
        }>('/estimator/photos', {
          propertyId,
          areaKey,
          areaLabel,
          url:         publicUrl,
          storagePath: path,
          caption,
          sortOrder,
        });

        const photoId = response.data.data.id;

        // 7 + 8. Clear uploading state and return
        return { photoId, url: publicUrl, areaKey };
      } finally {
        setArea(areaKey, false);
      }
    },
    [user, setArea],
  );

  // ── deletePhoto ──────────────────────────────────────────────────────────

  const deletePhoto = useCallback(
    async (photoId: string): Promise<void> => {
      await api.delete(`/estimator/photos/${photoId}`);
    },
    [],
  );

  return { uploadPhoto, deletePhoto, uploading };
}
