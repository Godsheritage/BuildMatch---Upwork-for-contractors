import { useState, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from './useAuth';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EvidenceType = 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'OTHER';

interface UseDisputeEvidenceUpload {
  uploadEvidence: (file: File, disputeId: string) => Promise<string>;
  isUploading:    boolean;
  uploadProgress: number;
  error:          string | null;
  evidenceType:   EvidenceType | null;
  reset:          () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
]);

const VIDEO_TYPES   = new Set(['video/mp4', 'video/quicktime']);
const MAX_PHOTO_DOC = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO     = 100 * 1024 * 1024; // 100 MB

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEvidenceType(mimeType: string): EvidenceType {
  if (mimeType.startsWith('image/'))   return 'PHOTO';
  if (mimeType.startsWith('video/'))   return 'VIDEO';
  if (mimeType === 'application/pdf')  return 'DOCUMENT';
  return 'OTHER';
}

function getExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName) return fromName;
  // Derive from MIME type as fallback
  const mimeMap: Record<string, string> = {
    'image/jpeg':       'jpg',
    'image/png':        'png',
    'image/webp':       'webp',
    'image/heic':       'heic',
    'image/heif':       'heif',
    'video/mp4':        'mp4',
    'video/quicktime':  'mov',
    'application/pdf':  'pdf',
  };
  return mimeMap[file.type] ?? 'bin';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDisputeEvidenceUpload(): UseDisputeEvidenceUpload {
  const { user }                          = useAuth();
  const [isUploading, setIsUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError]                 = useState<string | null>(null);
  const [evidenceType, setEvidenceType]   = useState<EvidenceType | null>(null);
  const progressTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    setIsUploading(false);
    setUploadProgress(0);
    setError(null);
    setEvidenceType(null);
  }

  async function uploadEvidence(file: File, disputeId: string): Promise<string> {
    setError(null);
    setUploadProgress(0);

    // ── 1. Validate file type ────────────────────────────────────────────────
    if (!ALLOWED_TYPES.has(file.type)) {
      const msg = 'Only images, videos, and PDF documents are allowed as dispute evidence';
      setError(msg);
      throw new Error(msg);
    }

    // ── 2. Validate file size ────────────────────────────────────────────────
    const maxSize = VIDEO_TYPES.has(file.type) ? MAX_VIDEO : MAX_PHOTO_DOC;
    if (file.size > maxSize) {
      const limit = VIDEO_TYPES.has(file.type) ? '100 MB' : '10 MB';
      const msg   = `File is too large. Maximum size for ${getEvidenceType(file.type).toLowerCase()}s is ${limit}`;
      setError(msg);
      throw new Error(msg);
    }

    if (!user) {
      const msg = 'You must be logged in to upload evidence';
      setError(msg);
      throw new Error(msg);
    }

    // ── 3. Build storage path ────────────────────────────────────────────────
    const ext  = getExtension(file);
    const path = `${user.id}/${disputeId}/${Date.now()}.${ext}`;

    setIsUploading(true);
    setUploadProgress(20);

    // Simulate mid-upload progress after 1 second
    progressTimer.current = setTimeout(() => {
      setUploadProgress(60);
    }, 1000);

    try {
      // ── 4. Get presigned URL from backend (bypasses RLS) ──────────────────
      const { data: presignData } = await api.post<{
        data: { signedUrl: string; token: string; path: string };
      }>('/upload/presign', { bucket: 'dispute-evidence', path });
      const { token, path: confirmedPath } = presignData.data;

      // ── 5. Upload via signed URL ───────────────────────────────────────────
      const supabase = getSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from('dispute-evidence')
        .uploadToSignedUrl(confirmedPath, token, file, { contentType: file.type });

      if (uploadError) {
        throw new Error(uploadError.message ?? 'Upload failed');
      }

      setUploadProgress(100);

      // ── 6. Get public URL ──────────────────────────────────────────────────
      const { data: urlData } = supabase.storage
        .from('dispute-evidence')
        .getPublicUrl(confirmedPath);

      const publicUrl = urlData.publicUrl;

      // ── 7. Update derived state ────────────────────────────────────────────
      setEvidenceType(getEvidenceType(file.type));

      return publicUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(msg);
      throw new Error(msg);
    } finally {
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
        progressTimer.current = null;
      }
      setIsUploading(false);
    }
  }

  return { uploadEvidence, isUploading, uploadProgress, error, evidenceType, reset };
}
