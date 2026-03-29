import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { getAuditLog } from '../../services/admin/audit.service';

const router = Router();

const AUDIT_ACTIONS = [
  'USER_SUSPEND', 'USER_UNSUSPEND', 'USER_BAN', 'USER_UNBAN',
  'USER_ROLE_CHANGE', 'USER_VERIFY', 'USER_IMPERSONATE',
  'JOB_REMOVE', 'JOB_FEATURE', 'JOB_STATUS_CHANGE',
  'DISPUTE_RULING', 'DISPUTE_NOTE', 'DISPUTE_CLOSE',
  'REVIEW_APPROVE', 'REVIEW_REMOVE', 'REVIEW_EDIT',
  'MESSAGE_VIEW', 'MESSAGE_REMOVE',
  'PAYMENT_RETRY', 'PAYMENT_REFUND',
  'SETTING_CHANGE', 'FEATURE_FLAG_CHANGE',
  'FILTER_PATTERN_ADD', 'FILTER_PATTERN_REMOVE',
] as const;

const querySchema = z.object({
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(25),
  action:  z.enum(AUDIT_ACTIONS).optional(),
  adminId: z.string().optional(),
});

// GET /api/admin/audit
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await getAuditLog(parsed.data);
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/audit] GET / error:', err);
    sendError(res, 'Failed to fetch audit log', 500);
  }
});

export default router;
