/**
 * src/routes/admin/settings.routes.ts
 * Mounted at: /api/admin/settings
 * Guards: authenticate + requireAdmin (applied in admin/index.ts)
 *
 * GET  /                         — all platform_settings + all feature_flags
 * PUT  /:key                     — update a setting value; logs oldValue + note
 * PUT  /flags/:key               — enable/disable a feature flag
 * GET  /filter-patterns          — list active contact-filter regex patterns
 * POST /filter-patterns          — append a new pattern (validates regex)
 * DELETE /filter-patterns/:patternId — remove a pattern by id
 */

import { Router }       from 'express';
import type { Request, Response } from 'express';
import { z }            from 'zod';
import { randomUUID } from 'crypto';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError }     from '../../utils/app-error';
import {
  getSettings,
  getSetting,
  updateSetting,
} from '../../services/admin/platform-settings.service';
import { getFeatureFlags, updateFeatureFlag } from '../../services/admin/feature-flags.service';
import { writeAuditLog } from '../../services/admin/audit.service';
import { getServiceClient } from '../../lib/supabase';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────────

const updateSettingSchema = z.object({
  value: z.unknown(),
  note:  z.string().max(500).optional(),
});

const updateFlagSchema = z.object({
  enabled:    z.boolean(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
});

const addPatternSchema = z.object({
  pattern:     z.string().min(1).max(500),
  type:        z.string().min(1).max(100),
  description: z.string().max(300).default(''),
});

// ── Internal types ─────────────────────────────────────────────────────────────

interface FilterPattern {
  id:          string;
  pattern:     string;
  type:        string;
  description: string;
  addedAt:     string;
}

const FILTER_PATTERNS_KEY = 'contact_filter_patterns';

async function getFilterPatternsArray(): Promise<FilterPattern[]> {
  const setting = await getSetting(FILTER_PATTERNS_KEY);
  if (!setting) return [];
  const raw = setting.value;
  if (!Array.isArray(raw)) return [];
  return raw as FilterPattern[];
}

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [settings, flags] = await Promise.all([getSettings(), getFeatureFlags()]);
    sendSuccess(res, { settings, flags });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/settings] GET / error:', err);
    sendError(res, 'Failed to fetch settings', 500);
  }
});

// ── GET /filter-patterns ──────────────────────────────────────────────────────
// Must be declared before PUT /:key to avoid param collision.

router.get('/filter-patterns', async (_req: Request, res: Response): Promise<void> => {
  try {
    const patterns = await getFilterPatternsArray();
    sendSuccess(res, { patterns });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/settings] GET /filter-patterns error:', err);
    sendError(res, 'Failed to fetch filter patterns', 500);
  }
});

// ── POST /filter-patterns ─────────────────────────────────────────────────────

router.post('/filter-patterns', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;

  const parsed = addPatternSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  const { pattern, type, description } = parsed.data;

  // Validate that the pattern is a valid regex.
  try {
    new RegExp(pattern);
  } catch {
    sendError(res, 'pattern must be a valid regular expression', 400);
    return;
  }

  try {
    const existing = await getFilterPatternsArray();
    const newPattern: FilterPattern = {
      id:          randomUUID(),
      pattern,
      type,
      description,
      addedAt:     new Date().toISOString(),
    };
    const updated = [...existing, newPattern];

    await upsertFilterPatterns(updated);

    void writeAuditLog({
      adminId,
      action:     'FILTER_PATTERN_ADD',
      targetType: 'filter_pattern',
      targetId:   newPattern.id,
      payload:    { pattern, type, description },
      ipAddress:  req.ip,
    });

    sendSuccess(res, { pattern: newPattern }, 'Filter pattern added');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/settings] POST /filter-patterns error:', err);
    sendError(res, 'Failed to add filter pattern', 500);
  }
});

// ── DELETE /filter-patterns/:patternId ────────────────────────────────────────

router.delete('/filter-patterns/:patternId', async (req: Request, res: Response): Promise<void> => {
  const adminId   = req.user!.userId;
  const { patternId } = req.params;

  try {
    const existing = await getFilterPatternsArray();
    const target   = existing.find(p => p.id === patternId);

    if (!target) {
      sendError(res, `Filter pattern "${patternId}" not found`, 404);
      return;
    }

    const updated = existing.filter(p => p.id !== patternId);
    await upsertFilterPatterns(updated);

    void writeAuditLog({
      adminId,
      action:     'FILTER_PATTERN_REMOVE',
      targetType: 'filter_pattern',
      targetId:   patternId,
      payload:    { pattern: target.pattern, type: target.type },
      ipAddress:  req.ip,
    });

    sendSuccess(res, null, 'Filter pattern removed');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/settings] DELETE /filter-patterns/:patternId error:', err);
    sendError(res, 'Failed to remove filter pattern', 500);
  }
});

// ── PUT /flags/:key ───────────────────────────────────────────────────────────
// Must be declared before PUT /:key so "flags" is not captured as a key param.

router.put('/flags/:key', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { key } = req.params;

  const parsed = updateFlagSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    const updated = await updateFeatureFlag(
      adminId, key, parsed.data.enabled, parsed.data.rolloutPct,
    );
    void writeAuditLog({
      adminId,
      action:     'FEATURE_FLAG_CHANGE',
      targetType: 'feature_flag',
      targetId:   key,
      payload:    { key, enabled: parsed.data.enabled, rolloutPct: parsed.data.rolloutPct },
      ipAddress:  req.ip,
    });
    sendSuccess(res, updated, `Flag "${key}" updated`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/settings] PUT /flags/:key error:', err);
    sendError(res, 'Failed to update feature flag', 500);
  }
});

// ── PUT /:key ─────────────────────────────────────────────────────────────────

router.put('/:key', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { key } = req.params;

  const parsed = updateSettingSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  const { value, note } = parsed.data;

  try {
    // Fetch old value for the audit log before updating.
    const existing = await getSetting(key);
    if (!existing) {
      sendError(res, `Setting "${key}" not found`, 404);
      return;
    }

    const updated = await updateSetting(adminId, key, value);

    void writeAuditLog({
      adminId,
      action:     'SETTING_CHANGE',
      targetType: 'platform_setting',
      targetId:   key,
      payload:    { key, oldValue: existing.value, newValue: value, note: note ?? null },
      ipAddress:  req.ip,
      note:       note,
    });

    sendSuccess(res, updated, `Setting "${key}" updated`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/settings] PUT /:key error:', err);
    sendError(res, 'Failed to update setting', 500);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function upsertFilterPatterns(patterns: FilterPattern[]): Promise<void> {
  const { error } = await getServiceClient()
    .from('platform_settings')
    .upsert({
      key:        FILTER_PATTERNS_KEY,
      value:      patterns,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (error) throw new AppError('Failed to save filter patterns', 500);
}

export default router;
