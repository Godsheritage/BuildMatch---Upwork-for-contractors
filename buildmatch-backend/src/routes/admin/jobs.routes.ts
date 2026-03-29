import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import {
  listJobs,
  getJobDetail,
  forceCloseJob,
} from '../../services/admin/jobs.service';
import { writeAuditLog } from '../../services/admin/audit.service';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(25),
  search:     z.string().optional(),
  status:     z.enum(['OPEN', 'AWARDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  tradeType:  z.enum([
    'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING',
    'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
  ]).optional(),
});

const forceCloseSchema = z.object({
  note: z.string().max(300).optional(),
});

// ── GET /api/admin/jobs ───────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await listJobs(parsed.data);
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/jobs] GET / error:', err);
    sendError(res, 'Failed to fetch jobs', 500);
  }
});

// ── GET /api/admin/jobs/:jobId ────────────────────────────────────────────────

router.get('/:jobId', async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await getJobDetail(req.params.jobId);
    sendSuccess(res, job);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/jobs] GET /:id error:', err);
    sendError(res, 'Failed to fetch job', 500);
  }
});

// ── PUT /api/admin/jobs/:jobId/force-close ────────────────────────────────────

router.put('/:jobId/force-close', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { jobId } = req.params;

  const parsed = forceCloseSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    const { previousStatus } = await forceCloseJob(jobId);
    await writeAuditLog({
      adminId,
      action:     'JOB_STATUS_CHANGE',
      targetType: 'job',
      targetId:   jobId,
      payload:    { previousStatus },
      ipAddress:  req.ip,
      note:       parsed.data.note,
    });
    sendSuccess(res, null, 'Job force-closed');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/jobs] PUT /:id/force-close error:', err);
    sendError(res, 'Failed to force-close job', 500);
  }
});

export default router;
