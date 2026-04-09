import { useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from './useAuth';
import api from '../services/api';

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
// Reuse the dispute-evidence bucket — it already has presign + RLS configured.
// If you provision a dedicated `id-documents` bucket later, change this constant.
const BUCKET = 'dispute-evidence';

interface UseIdDocumentUpload {
  uploadIdDocument: (file: File) => Promise<string>;
  isUploading:      boolean;
  error:            string | null;
}

export function useIdDocumentUpload(): UseIdDocumentUpload {
  const { user }                      = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function uploadIdDocument(file: File): Promise<string> {
    setError(null);

    if (!ALLOWED.has(file.type)) {
      const msg = 'Only JPG, PNG, WEBP, HEIC images, or PDF documents are allowed.';
      setError(msg);
      throw new Error(msg);
    }
    if (file.size > MAX_BYTES) {
      const msg = 'File is too large. The maximum size is 10 MB.';
      setError(msg);
      throw new Error(msg);
    }
    if (!user) throw new Error('You must be signed in.');

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const path = `${user.id}/id-document/${Date.now()}.${ext}`;

    setIsUploading(true);
    try {
      const { data: presignRes } = await api.post<{
        data: { signedUrl: string; token: string; path: string };
      }>('/upload/presign', { bucket: BUCKET, path });
      const { token, path: confirmedPath } = presignRes.data;

      const supabase = getSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(confirmedPath, token, file, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(confirmedPath);
      return urlData.publicUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsUploading(false);
    }
  }

  return { uploadIdDocument, isUploading, error };
}
