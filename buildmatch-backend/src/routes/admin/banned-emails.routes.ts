/**
 * src/routes/admin/banned-emails.routes.ts
 *
 * Banned email management.
 * Mounted at: /api/admin/banned-emails
 *
 * GET    /api/admin/banned-emails          — paginated list
 * POST   /api/admin/banned-emails          — ban an email address
 * DELETE /api/admin/banned-emails/:email   — unban (URL-encoded email)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { getBannedEmails, banEmail, unbanEmail } from '../../services/admin/banned-emails.service';
import { writeAuditLog } from '../../services/admin/audit.service';

const router = Router();

const listQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
});

const banSchema = z.object({
  email:  z.string().email(),
  reason: z.string().max(300).optional(),
});

// ── GET /api/admin/banned-emails ─────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await getBannedEmails(parsed.data);
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/banned-emails] GET / error:', err);
    sendError(res, 'Failed to fetch banned emails', 500);
  }
});

// ── POST /api/admin/banned-emails ────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;

  const parsed = banSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    await banEmail(adminId, parsed.data.email, parsed.data.reason);
    void writeAuditLog({
      adminId,
      action:     'FILTER_PATTERN_ADD',
      targetType: 'banned_email',
      targetId:   parsed.data.email.toLowerCase(),
      payload:    { reason: parsed.data.reason ?? null },
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, `${parsed.data.email} banned`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/banned-emails] POST / error:', err);
    sendError(res, 'Failed to ban email', 500);
  }
});

// ── DELETE /api/admin/banned-emails/:email ────────────────────────────────────

router.delete('/:email', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const email   = decodeURIComponent(req.params.email);

  try {
    await unbanEmail(email);
    void writeAuditLog({
      adminId,
      action:     'FILTER_PATTERN_REMOVE',
      targetType: 'banned_email',
      targetId:   email.toLowerCase(),
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, `${email} unbanned`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/banned-emails] DELETE /:email error:', err);
    sendError(res, 'Failed to unban email', 500);
  }
});

export default router;
