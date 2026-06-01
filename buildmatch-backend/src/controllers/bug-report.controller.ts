import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import { submitBugReportSchema } from '../schemas/bug-report.schemas';
import { createBugReport } from '../services/bug-report.service';

export async function submitBugReport(req: Request, res: Response): Promise<void> {
  const parsed = submitBugReportSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
    return;
  }
  try {
    const userId = req.user?.userId ?? null;
    const result = await createBugReport(parsed.data, userId, req.ip ?? null);
    sendSuccess(res, result, 'Thanks — your report has been submitted.', 201);
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else { console.error('[bug-report] submit', err); sendError(res, 'Failed to submit', 500); }
  }
}
