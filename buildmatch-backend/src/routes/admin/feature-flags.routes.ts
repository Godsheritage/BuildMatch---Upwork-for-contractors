/**
 * src/routes/admin/feature-flags.routes.ts
 *
 * Feature flag management.
 * Mounted at: /api/admin/flags
 *
 * GET  /api/admin/flags          — list all flags
 * PUT  /api/admin/flags/:key     — enable/disable a flag
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { getFeatureFlags, updateFeatureFlag } from '../../services/admin/feature-flags.service';
import { writeAuditLog } from '../../services/admin/audit.service';

const router = Router();
router.use(authenticate, requireAdmin);

const updateSchema = z.object({
  enabled:    z.boolean(),
  rolloutPct: z.number().int().min(0).max(100).optional(),
});

// ── GET /api/admin/flags ─────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const flags = await getFeatureFlags();
    sendSuccess(res, flags);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/flags] GET / error:', err);
    sendError(res, 'Failed to fetch feature flags', 500);
  }
});

// ── PUT /api/admin/flags/:key ────────────────────────────────────────────────

router.put('/:key', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { key } = req.params;

  const parsed = updateSchema.safeParse(req.body);
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
      payload:    { enabled: parsed.data.enabled, rolloutPct: parsed.data.rolloutPct },
      ipAddress:  req.ip,
    });
    sendSuccess(res, updated, `Flag "${key}" updated`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/flags] PUT /:key error:', err);
    sendError(res, 'Failed to update feature flag', 500);
  }
});

export default router;
