import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { getAuditLog } from '../../services/admin/audit.service';

const router = Router();
router.use(authenticate, requireAdmin);

const AUDIT_ACTIONS = [
  'USER_BANNED', 'USER_UNBANNED', 'USER_ROLE_CHANGED',
  'CONTRACTOR_LICENSE_VERIFIED', 'CONTRACTOR_LICENSE_UNVERIFIED',
  'CONTRACTOR_AVAILABILITY_TOGGLED', 'JOB_FORCE_CLOSED',
  'DISPUTE_RULING', 'DISPUTE_STATUS_CHANGED',
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
