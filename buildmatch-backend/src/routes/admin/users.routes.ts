/**
 * src/routes/admin/users.routes.ts
 *
 * Admin user-management endpoints. Auth + ADMIN guard are applied once in
 * the parent index.ts — do NOT re-apply here.
 *
 * Route ordering: static segments (/flagged) declared before dynamic params
 * (/:userId) to prevent Express param capture.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { writeAuditLog } from '../../services/admin/audit.service';
import {
  listUsers,
  getUserFullProfile,
  getFlaggedUsers,
  suspendUser,
  unsuspendUser,
  banUser,
  verifyContractor,
  changeUserRole,
  impersonateUser,
  sendAdminMessage,
} from '../../services/admin/users.service';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(25),
  search:    z.string().optional(),
  role:      z.enum(['INVESTOR', 'CONTRACTOR', 'ADMIN']).optional(),
  status:    z.enum(['active', 'suspended', 'banned']).optional(),
  isVerified: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  dateFrom:  z.string().optional(),
  dateTo:    z.string().optional(),
  sortBy:    z.enum(['createdAt', 'email', 'firstName', 'lastName']).default('createdAt'),
  sortDir:   z.enum(['asc', 'desc']).default('desc'),
});

const suspendSchema = z.object({
  reason:      z.string().min(5).max(500),
  durationDays: z.number().int().min(1).max(3650).nullable().optional(),
});

const banSchema = z.object({
  reason: z.string().min(5).max(500),
});

const roleSchema = z.object({
  role: z.enum(['INVESTOR', 'CONTRACTOR']),
  note: z.string().max(300).optional(),
});

const sendMessageSchema = z.object({
  subject: z.string().min(3).max(200),
  content: z.string().min(10).max(5000),
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

// ── GET /api/admin/users/flagged ──────────────────────────────────────────────
// Static segment MUST be declared before /:userId.

router.get('/flagged', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await getFlaggedUsers();
    sendSuccess(res, { users });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] GET /flagged error:', err);
    sendError(res, 'Failed to fetch flagged users', 500);
  }
});

// ── GET /api/admin/users/:userId ──────────────────────────────────────────────

router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getUserFullProfile(req.params.userId);
    sendSuccess(res, user);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] GET /:userId error:', err);
    sendError(res, 'Failed to fetch user', 500);
  }
});

// ── POST /api/admin/users/:id/suspend ─────────────────────────────────────────

router.post('/:id/suspend', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { id: userId } = req.params;

  const parsed = suspendSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    await suspendUser(userId, parsed.data.reason, parsed.data.durationDays ?? null);
    await writeAuditLog({
      adminId,
      action:     'USER_SUSPEND',
      targetType: 'user',
      targetId:   userId,
      payload:    { reason: parsed.data.reason, durationDays: parsed.data.durationDays },
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, 'User suspended successfully');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] POST /:id/suspend error:', err);
    sendError(res, 'Failed to suspend user', 500);
  }
});

// ── POST /api/admin/users/:id/unsuspend ───────────────────────────────────────

router.post('/:id/unsuspend', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { id: userId } = req.params;

  try {
    await unsuspendUser(userId);
    await writeAuditLog({
      adminId,
      action:     'USER_UNSUSPEND',
      targetType: 'user',
      targetId:   userId,
      payload:    {},
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, 'User unsuspended successfully');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] POST /:id/unsuspend error:', err);
    sendError(res, 'Failed to unsuspend user', 500);
  }
});

// ── POST /api/admin/users/:id/ban ─────────────────────────────────────────────

router.post('/:id/ban', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { id: userId } = req.params;

  const parsed = banSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    await banUser(userId, parsed.data.reason);
    await writeAuditLog({
      adminId,
      action:     'USER_BAN',
      targetType: 'user',
      targetId:   userId,
      payload:    { reason: parsed.data.reason },
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, 'User banned successfully');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] POST /:id/ban error:', err);
    sendError(res, 'Failed to ban user', 500);
  }
});

// ── POST /api/admin/users/:id/verify-contractor ───────────────────────────────

router.post('/:id/verify-contractor', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { id: userId } = req.params;

  try {
    await verifyContractor(userId);
    await writeAuditLog({
      adminId,
      action:     'USER_VERIFY',
      targetType: 'user',
      targetId:   userId,
      payload:    {},
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, 'Contractor license verified');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] POST /:id/verify-contractor error:', err);
    sendError(res, 'Failed to verify contractor', 500);
  }
});

// ── POST /api/admin/users/:id/change-role ─────────────────────────────────────

router.post('/:id/change-role', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { id: userId } = req.params;

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
    console.error('[admin/users] POST /:id/change-role error:', err);
    sendError(res, 'Failed to change user role', 500);
  }
});

// ── POST /api/admin/users/:id/impersonate ─────────────────────────────────────

router.post('/:id/impersonate', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { id: userId } = req.params;

  try {
    const result = await impersonateUser(userId, adminId);
    await writeAuditLog({
      adminId,
      action:     'USER_IMPERSONATE',
      targetType: 'user',
      targetId:   userId,
      payload:    { userEmail: result.userEmail, userRole: result.userRole },
      ipAddress:  req.ip,
    });
    sendSuccess(res, result, 'Impersonation token issued');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] POST /:id/impersonate error:', err);
    sendError(res, 'Failed to impersonate user', 500);
  }
});

// ── POST /api/admin/users/:id/send-message ────────────────────────────────────

router.post('/:id/send-message', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { id: userId } = req.params;

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    await sendAdminMessage(userId, parsed.data.subject, parsed.data.content);
    await writeAuditLog({
      adminId,
      action:     'MESSAGE_VIEW',  // closest audit action for admin outreach
      targetType: 'user',
      targetId:   userId,
      payload:    { subject: parsed.data.subject },
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, 'Message sent successfully');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/users] POST /:id/send-message error:', err);
    sendError(res, 'Failed to send message', 500);
  }
});

// ── Legacy PUT endpoints (backward compat for existing admin UI) ───────────────
// These delegate to the same service functions as the POST equivalents above.

router.put('/:userId/ban', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { userId } = req.params;
  try {
    await banUser(userId, req.body?.reason ?? 'Banned by admin');
    await writeAuditLog({ adminId, action: 'USER_BAN', targetType: 'user', targetId: userId, payload: {}, ipAddress: req.ip });
    sendSuccess(res, null, 'User banned successfully');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Failed to ban user', 500);
  }
});

router.put('/:userId/unban', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { userId } = req.params;
  try {
    await unsuspendUser(userId);
    await writeAuditLog({ adminId, action: 'USER_UNBAN', targetType: 'user', targetId: userId, payload: {}, ipAddress: req.ip });
    sendSuccess(res, null, 'User unbanned successfully');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Failed to unban user', 500);
  }
});

router.put('/:userId/role', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { userId } = req.params;
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) { sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400); return; }
  try {
    const { previousRole } = await changeUserRole(userId, parsed.data.role, adminId);
    await writeAuditLog({ adminId, action: 'USER_ROLE_CHANGE', targetType: 'user', targetId: userId, payload: { previousRole, newRole: parsed.data.role }, ipAddress: req.ip, note: parsed.data.note });
    sendSuccess(res, null, `Role changed to ${parsed.data.role}`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Failed to change user role', 500);
  }
});

export default router;
