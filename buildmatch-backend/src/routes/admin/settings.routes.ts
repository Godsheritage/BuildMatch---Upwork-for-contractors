/**
 * src/routes/admin/settings.routes.ts
 *
 * Platform settings management.
 * Mounted at: /api/admin/settings
 *
 * GET  /api/admin/settings          — list all settings
 * PUT  /api/admin/settings/:key     — update a setting value
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { getSettings, updateSetting } from '../../services/admin/platform-settings.service';
import { writeAuditLog } from '../../services/admin/audit.service';

const router = Router();

const updateSchema = z.object({
  value: z.unknown(),
});

// ── GET /api/admin/settings ───────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getSettings();
    sendSuccess(res, settings);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/settings] GET / error:', err);
    sendError(res, 'Failed to fetch settings', 500);
  }
});

// ── PUT /api/admin/settings/:key ─────────────────────────────────────────────

router.put('/:key', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { key } = req.params;

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 'Invalid request body', 400);
    return;
  }

  try {
    const updated = await updateSetting(adminId, key, parsed.data.value);
    void writeAuditLog({
      adminId,
      action:     'SETTING_CHANGE',
      targetType: 'platform_setting',
      targetId:   key,
      payload:    { value: parsed.data.value },
      ipAddress:  req.ip,
    });
    sendSuccess(res, updated, `Setting "${key}" updated`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/settings] PUT /:key error:', err);
    sendError(res, 'Failed to update setting', 500);
  }
});

export default router;
