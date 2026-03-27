import { useState, useCallback, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from './useAuth';
import api from '../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/mov', 'video/quicktime', 'video/mpeg']);
const MAX_PHOTO_SIZE  = 15  * 1024 * 1024; // 15 MB
const MAX_VIDEO_SIZE  = 200 * 1024 * 1024; // 200 MB
const MAX_PHOTOS      = 20;
const MAX_VIDEOS      = 3;
const PHOTO_BUCKET    = 'job-photos';
const VIDEO_BUCKET    = 'job-videos';

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractStoragePath(url: string, bucket: string): string {
  const base = `${import.meta.env.VITE_SUPABASE_URL as string}/storage/v1/object/public/${bucket}/`;
  return url.replace(base, '');
}

function getExt(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() ?? 'bin';
}

async function presignAndUpload(
  bucket: string,
  path: string,
  file: File,
): Promise<string> {
  // Get signed upload URL from backend (bypasses RLS)
  const { data } = await api.post<{ data: { signedUrl: string; token: string; path: string } }>(
    '/upload/presign',
    { bucket, path },
  );
  const { signedUrl, token } = data.data;

  // Upload directly to Supabase using the signed URL
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file, { contentType: file.type });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

async function deleteViaBackend(bucket: string, path: string): Promise<void> {
  await api.delete('/upload', { data: { bucket, path } });
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export default function useJobMediaUpload() {
  const { user } = useAuth();

  // Stable draft ID for organising files under a consistent prefix this session
  const jobDraftId = useRef(crypto.randomUUID());

  const [pendingPhotoUrls, setPendingPhotoUrls] = useState<string[]>([]);
  const [pendingVideoUrls, setPendingVideoUrls] = useState<string[]>([]);
  const [uploadingPhotos,  setUploadingPhotos]  = useState(false);
  const [uploadingVideos,  setUploadingVideos]  = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  // ── Photos ──────────────────────────────────────────────────────────────────

  const addPhotos = useCallback(async (files: FileList): Promise<void> => {
    setPhotoUploadError(null);

    const fileArray = Array.from(files);

    // Validate all files before uploading any of them
    for (const file of fileArray) {
      if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        const msg = 'Only JPG, PNG, WebP, or HEIC images are allowed';
        setPhotoUploadError(msg);
        throw new Error(msg);
      }
      if (file.size > MAX_PHOTO_SIZE) {
        const msg = `${file.name} is too large. Max 15MB per photo`;
        setPhotoUploadError(msg);
        throw new Error(msg);
      }
    }

    // Check total cap using functional read so we get the latest value
    setPendingPhotoUrls((current) => {
      if (current.length + fileArray.length > MAX_PHOTOS) {
        const msg = 'Maximum 20 photos per job';
        setPhotoUploadError(msg);
        throw new Error(msg);
      }
      return current; // no change — actual append happens after upload
    });

    setUploadingPhotos(true);
    try {
      const draftId = jobDraftId.current;
      const userId  = user!.id;

      const uploadedUrls = await Promise.all(
        fileArray.map(async (file, index) => {
          const ext  = getExt(file);
          const path = `${userId}/${draftId}/${Date.now()}-${index}.${ext}`;
          return presignAndUpload(PHOTO_BUCKET, path, file);
        })
      );

      setPendingPhotoUrls((prev) => [...prev, ...uploadedUrls]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Photo upload failed';
      setPhotoUploadError(msg);
      throw err;
    } finally {
      setUploadingPhotos(false);
    }
  }, [user]);

  const removePhoto = useCallback(async (url: string): Promise<void> => {
    setPhotoUploadError(null);
    const path = extractStoragePath(url, PHOTO_BUCKET);

    try {
      await deleteViaBackend(PHOTO_BUCKET, path);
      setPendingPhotoUrls((prev) => prev.filter((u) => u !== url));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove photo';
      setPhotoUploadError(msg);
      throw err;
    }
  }, []);

  // ── Videos ──────────────────────────────────────────────────────────────────

  const addVideo = useCallback(async (file: File): Promise<void> => {
    setVideoUploadError(null);

    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      const msg = 'Only MP4 or MOV videos are allowed';
      setVideoUploadError(msg);
      throw new Error(msg);
    }
    if (file.size > MAX_VIDEO_SIZE) {
      const msg = 'Video must be under 200MB';
      setVideoUploadError(msg);
      throw new Error(msg);
    }

    setPendingVideoUrls((current) => {
      if (current.length >= MAX_VIDEOS) {
        const msg = 'Maximum 3 videos per job';
        setVideoUploadError(msg);
        throw new Error(msg);
      }
      return current;
    });

    setUploadingVideos(true);
    try {
      const ext  = getExt(file);
      const path = `${user!.id}/${jobDraftId.current}/${Date.now()}.${ext}`;
      const publicUrl = await presignAndUpload(VIDEO_BUCKET, path, file);
      setPendingVideoUrls((prev) => [...prev, publicUrl]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Video upload failed';
      setVideoUploadError(msg);
      throw err;
    } finally {
      setUploadingVideos(false);
    }
  }, [user]);

  const removeVideo = useCallback(async (url: string): Promise<void> => {
    setVideoUploadError(null);
    const path = extractStoragePath(url, VIDEO_BUCKET);

    try {
      await deleteViaBackend(VIDEO_BUCKET, path);
      setPendingVideoUrls((prev) => prev.filter((u) => u !== url));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove video';
      setVideoUploadError(msg);
      throw err;
    }
  }, []);

  // ── Reset ────────────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    setPendingPhotoUrls([]);
    setPendingVideoUrls([]);
    setPhotoUploadError(null);
    setVideoUploadError(null);
    // Regenerate draft ID so the next session uses a fresh storage prefix
    jobDraftId.current = crypto.randomUUID();
  }, []);

  return {
    pendingPhotoUrls,
    pendingVideoUrls,
    uploadingPhotos,
    uploadingVideos,
    photoUploadError,
    videoUploadError,
    addPhotos,
    removePhoto,
    addVideo,
    removeVideo,
    clearAll,
  };
}
