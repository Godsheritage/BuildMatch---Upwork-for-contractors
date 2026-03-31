import { getServiceClient } from '../../lib/supabase';
import { AppError } from '../../utils/app-error';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformSetting {
  key:         string;
  value:       unknown;
  description: string | null;
  updatedBy:   string | null;
  updatedAt:   string;
}

// ── getSettings ───────────────────────────────────────────────────────────────

export async function getSettings(): Promise<PlatformSetting[]> {
  const { data, error } = await getServiceClient()
    .from('platform_settings')
    .select('*')
    .order('key', { ascending: true });

  if (error) throw new AppError('Failed to fetch platform settings', 500);

  return (data ?? []).map((r) => ({
    key:         r.key as string,
    value:       r.value,
    description: r.description as string | null,
    updatedBy:   r.updated_by as string | null,
    updatedAt:   r.updated_at as string,
  }));
}

// ── getSetting ────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<PlatformSetting | null> {
  const { data, error } = await getServiceClient()
    .from('platform_settings')
    .select('*')
    .eq('key', key)
    .single();

  if (error || !data) return null;

  return {
    key:         data.key as string,
    value:       data.value,
    description: data.description as string | null,
    updatedBy:   data.updated_by as string | null,
    updatedAt:   data.updated_at as string,
  };
}

// ── updateSetting ─────────────────────────────────────────────────────────────

export async function updateSetting(
  adminId: string,
  key: string,
  value: unknown,
): Promise<PlatformSetting> {
  const supabase = getServiceClient();

  // Ensure the key exists
  const { data: existing } = await supabase
    .from('platform_settings')
    .select('key')
    .eq('key', key)
    .single();

  if (!existing) throw new AppError(`Setting "${key}" not found`, 404);

  const { data, error } = await supabase
    .from('platform_settings')
    .update({ value, updated_by: adminId, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select('*')
    .single();

  if (error || !data) throw new AppError('Failed to update setting', 500);

  return {
    key:         data.key as string,
    value:       data.value,
    description: data.description as string | null,
    updatedBy:   data.updated_by as string | null,
    updatedAt:   data.updated_at as string,
  };
}
