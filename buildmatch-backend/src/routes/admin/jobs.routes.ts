import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import {
  listJobs,
  getContentQueue,
  getJobFullDetail,
  removeJob,
  toggleFeature,
  changeJobStatus,
  flagJob,
  forceCloseJob,         // legacy
} from '../../services/admin/jobs.service';
import { writeAuditLog } from '../../services/admin/audit.service';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:                z.coerce.number().int().min(1).default(1),
  limit:               z.coerce.number().int().min(1).max(100).default(25),
  search:              z.string().optional(),
  status:              z.enum(['OPEN', 'AWARDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  tradeType: z.enum([
    'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING',
    'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
  ]).optional(),
  state:               z.string().optional(),
  city:                z.string().optional(),
  investorId:          z.string().optional(),
  hasDispute:          z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  noBidsAfterDays:     z.coerce.number().int().min(1).optional(),
  stuckInProgressDays: z.coerce.number().int().min(1).optional(),
  isFeatured:          z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  isFlagged:           z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  dateFrom:            z.string().optional(),
  dateTo:              z.string().optional(),
  sortBy:              z.enum(['createdAt', 'title', 'budgetMin', 'status']).optional(),
});

const removeSchema = z.object({
  reason: z.string().min(5).max(500),
});

const changeStatusSchema = z.object({
  newStatus: z.enum(['OPEN', 'AWARDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  reason:    z.string().min(5).max(500),
});

const flagSchema = z.object({
  reason: z.string().min(5).max(500),
});

const forceCloseSchema = z.object({
  note: z.string().max(300).optional(),
});

// ── GET /api/admin/jobs — list with full filter set ───────────────────────────

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

// ── GET /api/admin/jobs/content-queue — flagged jobs awaiting review ──────────
// MUST be declared before /:jobId to prevent param capture

router.get('/content-queue', async (_req: Request, res: Response): Promise<void> => {
  try {
    const queue = await getContentQueue();
    sendSuccess(res, queue);
  } catch (err) {
    console.error('[admin/jobs] GET /content-queue error:', err);
    sendError(res, 'Failed to fetch content queue', 500);
  }
});

// ── GET /api/admin/jobs/:jobId — full job detail ──────────────────────────────

router.get('/:jobId', async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await getJobFullDetail(req.params.jobId);
    sendSuccess(res, job);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/jobs] GET /:jobId error:', err);
    sendError(res, 'Failed to fetch job', 500);
  }
});

// ── POST /api/admin/jobs/:jobId/remove — cancel + notify investor ─────────────

router.post('/:jobId/remove', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { jobId } = req.params;

  const parsed = removeSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    const { previousStatus, hadEscrow } = await removeJob(jobId, parsed.data.reason);
    await writeAuditLog({
      adminId,
      action:     'JOB_REMOVE',
      targetType: 'job',
      targetId:   jobId,
      payload:    { reason: parsed.data.reason, previousStatus, hadEscrow },
      ipAddress:  req.ip,
    });
    sendSuccess(res, { hadEscrow }, 'Job removed');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/jobs] POST /:jobId/remove error:', err);
    sendError(res, 'Failed to remove job', 500);
  }
});

// ── POST /api/admin/jobs/:jobId/feature — toggle isFeatured ──────────────────

router.post('/:jobId/feature', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { jobId } = req.params;

  try {
    const { isFeatured } = await toggleFeature(jobId);
    await writeAuditLog({
      adminId,
      action:     'JOB_FEATURE',
      targetType: 'job',
      targetId:   jobId,
      payload:    { featured: isFeatured },
      ipAddress:  req.ip,
    });
    sendSuccess(res, { isFeatured }, isFeatured ? 'Job featured' : 'Job unfeatured');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/jobs] POST /:jobId/feature error:', err);
    sendError(res, 'Failed to toggle feature', 500);
  }
});

// ── POST /api/admin/jobs/:jobId/change-status ─────────────────────────────────

router.post('/:jobId/change-status', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { jobId } = req.params;

  const parsed = changeStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    const { oldStatus, newStatus } = await changeJobStatus(
      jobId,
      parsed.data.newStatus,
      parsed.data.reason,
    );
    await writeAuditLog({
      adminId,
      action:     'JOB_STATUS_CHANGE',
      targetType: 'job',
      targetId:   jobId,
      payload:    { oldStatus, newStatus, reason: parsed.data.reason },
      ipAddress:  req.ip,
    });
    sendSuccess(res, { oldStatus, newStatus }, 'Job status updated');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/jobs] POST /:jobId/change-status error:', err);
    sendError(res, 'Failed to change job status', 500);
  }
});

// ── POST /api/admin/jobs/:jobId/flag — set isFlagged=true ────────────────────

router.post('/:jobId/flag', async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!.userId;
  const { jobId } = req.params;

  const parsed = flagSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }

  try {
    await flagJob(jobId, parsed.data.reason);
    await writeAuditLog({
      adminId,
      action:     'JOB_FLAG',
      targetType: 'job',
      targetId:   jobId,
      payload:    { reason: parsed.data.reason },
      ipAddress:  req.ip,
    });
    sendSuccess(res, null, 'Job flagged for review');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/jobs] POST /:jobId/flag error:', err);
    sendError(res, 'Failed to flag job', 500);
  }
});

// ── PUT /api/admin/jobs/:jobId/force-close — legacy compat ───────────────────

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
      payload:    { previousStatus, newStatus: 'CANCELLED' },
      ipAddress:  req.ip,
      note:       parsed.data.note,
    });
    sendSuccess(res, null, 'Job force-closed');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/jobs] PUT /:jobId/force-close error:', err);
    sendError(res, 'Failed to force-close job', 500);
  }
});

export default router;
