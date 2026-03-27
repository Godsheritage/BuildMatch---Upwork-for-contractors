const SUPABASE_STORAGE_SEGMENT = '/storage/v1/object/public/';
const SUPABASE_RENDER_SEGMENT  = '/storage/v1/render/image/public/';

export function getOptimizedUrl(url: string, width: number, quality = 80): string {
  if (!url || !url.includes(SUPABASE_STORAGE_SEGMENT)) return url;
  const base = url.replace(SUPABASE_STORAGE_SEGMENT, SUPABASE_RENDER_SEGMENT);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}width=${width}&quality=${quality}`;
}

export const JOB_PHOTO_FALLBACK =
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23E5E4E0'/%3E%3Cpath d='M21 15l-5-5L5 21' stroke='%23C0C0BC' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5' fill='%23C0C0BC'/%3E%3C/svg%3E`;
