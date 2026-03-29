import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import {
  listUsers,
  getUserDetail,
  setUserActive,
  changeUserRole,
} from '../../services/admin/users.service';
import { writeAuditLog } from '../../services/admin/audit.service';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(25),
  search:   z.string().optional(),
  role:     z.enum(['INVESTOR', 'CONTRACTOR', 'ADMIN']).optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});

const roleSchema = z.object({
  role: z.enum(['INVESTOR', 'CONTRACTOR']),
  note: z.string().max(300).optional(),
});

// ── GET /api/admin/users ───────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await listUsers(parsed.data);
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] GET / error:', err);
    sendError(res, 'Failed to fetch users', 500);
  }
});

// ── GET /api/admin/users/:userId ──────────────────────────────────────────────

router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getUserDetail(req.params.userId);
    sendSuccess(res, user);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] GET /:id error:', err);
    sendError(res, 'Failed to fetch user', 500);
  }
});

// ── PUT /api/admin/users/:userId/ban ──────────────────────────────────────────

router.put('/:userId/ban', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { userId } = req.params;
  try {
    await setUserActive(userId, false);
    await writeAuditLog({
      adminId,
      action:     'USER_BAN',
      targetType: 'user',
      targetId:   userId,
      payload:    {},
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, 'User banned successfully');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] PUT /:id/ban error:', err);
    sendError(res, 'Failed to ban user', 500);
  }
});

// ── PUT /api/admin/users/:userId/unban ────────────────────────────────────────

router.put('/:userId/unban', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { userId } = req.params;
  try {
    await setUserActive(userId, true);
    await writeAuditLog({
      adminId,
      action:     'USER_UNBAN',
      targetType: 'user',
      targetId:   userId,
      payload:    {},
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, 'User unbanned successfully');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] PUT /:id/unban error:', err);
    sendError(res, 'Failed to unban user', 500);
  }
});

// ── PUT /api/admin/users/:userId/role ─────────────────────────────────────────

router.put('/:userId/role', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { userId } = req.params;

  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    const { previousRole } = await changeUserRole(userId, parsed.data.role, adminId);
    await writeAuditLog({
      adminId,
      action:     'USER_ROLE_CHANGE',
      targetType: 'user',
      targetId:   userId,
      payload:    { previousRole, newRole: parsed.data.role },
      ipAddress:  req.ip,
      note:       parsed.data.note,
    });
    sendSuccess(res, null, `Role changed to ${parsed.data.role}`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] PUT /:id/role error:', err);
    sendError(res, 'Failed to change user role', 500);
  }
});

export default router;
