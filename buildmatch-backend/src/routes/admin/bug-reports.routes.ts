import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { writeAuditLog } from '../../services/admin/audit.service';
import { listBugReports, getNewCount, getBugReport, updateBugReport } from '../../services/bug-report.service';
import { updateBugReportSchema } from '../../schemas/bug-report.schemas';

const router = Router();

const listQuerySchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX']).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(25),
});

router.get('/count', async (_req: Request, res: Response): Promise<void> => {
  try {
    const newCount = await getNewCount();
    sendSuccess(res, { newCount });
  } catch (err) {
    console.error('[admin/bug-reports] count', err);
    sendError(res, 'Failed to fetch count', 500);
  }
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) { sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400); return; }
  try {
    const result = await listBugReports(parsed.data);
    sendSuccess(res, result);
  } catch (err) {
    console.error('[admin/bug-reports] list', err);
    sendError(res, 'Failed to fetch bug reports', 500);
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await getBugReport(req.params.id!);
    sendSuccess(res, row);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/bug-reports] get', err);
    sendError(res, 'Failed to fetch bug report', 500);
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = updateBugReportSchema.safeParse(req.body);
  if (!parsed.success) { sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400); return; }
  try {
    const updated = await updateBugReport(req.params.id!, parsed.data);
    if (parsed.data.status) {
      await writeAuditLog({
        adminId:    req.user!.userId,
        action:     'BUG_REPORT_STATUS_CHANGE',
        targetType: 'bug_report',
        targetId:   req.params.id!,
        payload:    { status: parsed.data.status },
        ipAddress:  req.ip,
        note:       parsed.data.adminNote ?? undefined,
      });
    }
    sendSuccess(res, updated, 'Updated');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/bug-reports] update', err);
    sendError(res, 'Failed to update', 500);
  }
});

export default router;
