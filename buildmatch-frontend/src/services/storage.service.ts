import { supabase } from '../lib/supabase';

/**
 * Upload an avatar for a user.
 * Path: avatars/{userId}/avatar.{ext}  — matches the RLS policy foldername check.
 * Uses upsert:true so re-uploads overwrite the existing file.
 */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload a single job photo.
 * Path: job-photos/{userId}/{timestamp}-{random}.{ext}
 */
export async function uploadJobPhoto(file: File, userId: string): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/${Date.now()}-${rand}.${ext}`;

  const { error } = await supabase.storage
    .from('job-photos')
    .upload(path, file, { contentType: file.type });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('job-photos').getPublicUrl(path);
  return data.publicUrl;
}
