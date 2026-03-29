import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import {
  listContractors,
  setLicenseVerified,
  setAvailability,
} from '../../services/admin/contractors.service';
import { writeAuditLog } from '../../services/admin/audit.service';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:              z.coerce.number().int().min(1).default(1),
  limit:             z.coerce.number().int().min(1).max(100).default(25),
  search:            z.string().optional(),
  state:             z.string().optional(),
  isLicenseVerified: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  isAvailable:       z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});

const availabilitySchema = z.object({
  isAvailable: z.boolean(),
});

// ── GET /api/admin/contractors ─────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await listContractors(parsed.data);
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/contractors] GET / error:', err);
    sendError(res, 'Failed to fetch contractors', 500);
  }
});

// ── PUT /api/admin/contractors/:profileId/verify-license ──────────────────────

router.put('/:profileId/verify-license', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { profileId } = req.params;
  try {
    const { licenseNumber, licenseState } = await setLicenseVerified(profileId, true);
    await writeAuditLog({
      adminId,
      action:     'USER_VERIFY',
      targetType: 'contractor',
      targetId:   profileId,
      payload:    { licenseNumber, licenseState },
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, 'License verified');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/contractors] PUT /:id/verify-license error:', err);
    sendError(res, 'Failed to verify license', 500);
  }
});

// ── PUT /api/admin/contractors/:profileId/unverify-license ────────────────────

router.put('/:profileId/unverify-license', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { profileId } = req.params;
  try {
    const { licenseNumber, licenseState } = await setLicenseVerified(profileId, false);
    await writeAuditLog({
      adminId,
      action:     'USER_VERIFY',
      targetType: 'contractor',
      targetId:   profileId,
      payload:    { licenseNumber, licenseState },
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, 'License unverified');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/contractors] PUT /:id/unverify-license error:', err);
    sendError(res, 'Failed to unverify license', 500);
  }
});

// ── PUT /api/admin/contractors/:profileId/availability ────────────────────────

router.put('/:profileId/availability', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { profileId } = req.params;

  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    await setAvailability(profileId, parsed.data.isAvailable);
    await writeAuditLog({
      adminId,
      action:     'SETTING_CHANGE',
      targetType: 'contractor',
      targetId:   profileId,
      payload:    { isAvailable: parsed.data.isAvailable },
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, `Availability set to ${parsed.data.isAvailable}`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/contractors] PUT /:id/availability error:', err);
    sendError(res, 'Failed to update availability', 500);
  }
});

export default router;
