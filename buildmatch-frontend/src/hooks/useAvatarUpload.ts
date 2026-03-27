import { useState, useCallback } from 'react';
import { getSupabaseClient } from '../lib/supabase';
import { useAuth } from './useAuth';
import api from '../services/api';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export default function useAvatarUpload() {
  const { user } = useAuth();
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error,          setError]          = useState<string | null>(null);

  const uploadAvatar = useCallback(async (file: File): Promise<string> => {
    setError(null);

    if (!ALLOWED_TYPES.has(file.type)) {
      const msg = 'Please upload a JPG, PNG, or WebP image';
      setError(msg);
      throw new Error(msg);
    }
    if (file.size > MAX_SIZE) {
      const msg = 'Image must be under 5MB';
      setError(msg);
      throw new Error(msg);
    }

    const ext  = file.name.split('.').pop() ?? 'jpg';
    const path = `${user!.id}/${Date.now()}.${ext}`;

    setIsUploading(true);
    setUploadProgress(30);

    // Supabase JS v2 has no native progress events — simulate with a timer
    const progressTimer = setTimeout(() => setUploadProgress(70), 500);

    try {
      const supabase = getSupabaseClient();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw new Error(uploadError.message);

      setUploadProgress(100);

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      throw err;
    } finally {
      clearTimeout(progressTimer);
      setIsUploading(false);
    }
  }, [user]);

  const deleteAvatar = useCallback(async (currentUrl: string): Promise<void> => {
    setError(null);

    const supabase = getSupabaseClient();
    const base = `${import.meta.env.VITE_SUPABASE_URL as string}/storage/v1/object/public/avatars/`;
    const path = currentUrl.replace(base, '');

    try {
      const { error: removeError } = await supabase.storage
        .from('avatars')
        .remove([path]);

      if (removeError) throw new Error(removeError.message);

      await api.delete('/users/me/avatar');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove avatar';
      setError(msg);
      throw err;
    }
  }, []);

  return { uploadAvatar, deleteAvatar, isUploading, uploadProgress, error };
}
