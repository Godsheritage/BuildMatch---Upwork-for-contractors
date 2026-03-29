import { getServiceClient } from '../../lib/supabase';
import { AppError } from '../../utils/app-error';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeatureFlag {
  key:         string;
  enabled:     boolean;
  rolloutPct:  number;
  description: string | null;
  updatedBy:   string | null;
  updatedAt:   string;
}

// ── getFeatureFlags ───────────────────────────────────────────────────────────

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await getServiceClient()
    .from('feature_flags')
    .select('*')
    .order('key', { ascending: true });

  if (error) throw new AppError('Failed to fetch feature flags', 500);

  return (data ?? []).map((r) => ({
    key:         r.key as string,
    enabled:     r.enabled as boolean,
    rolloutPct:  r.rollout_pct as number,
    description: r.description as string | null,
    updatedBy:   r.updated_by as string | null,
    updatedAt:   r.updated_at as string,
  }));
}

// ── updateFeatureFlag ─────────────────────────────────────────────────────────

export async function updateFeatureFlag(
  adminId: string,
  key: string,
  enabled: boolean,
  rolloutPct?: number,
): Promise<FeatureFlag> {
  const supabase = getServiceClient();

  const { data: existing } = await supabase
    .from('feature_flags')
    .select('key')
    .eq('key', key)
    .single();

  if (!existing) throw new AppError(`Feature flag "${key}" not found`, 404);

  const update: Record<string, unknown> = {
    enabled,
    updated_by: adminId,
    updated_at: new Date().toISOString(),
  };
  if (rolloutPct !== undefined) update.rollout_pct = rolloutPct;

  const { data, error } = await supabase
    .from('feature_flags')
    .update(update)
    .eq('key', key)
    .select('*')
    .single();

  if (error || !data) throw new AppError('Failed to update feature flag', 500);

  return {
    key:         data.key as string,
    enabled:     data.enabled as boolean,
    rolloutPct:  data.rollout_pct as number,
    description: data.description as string | null,
    updatedBy:   data.updated_by as string | null,
    updatedAt:   data.updated_at as string,
  };
}
