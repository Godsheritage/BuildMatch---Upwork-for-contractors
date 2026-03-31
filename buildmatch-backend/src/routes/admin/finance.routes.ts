/**
 * src/routes/admin/finance.routes.ts
 * Mounted at: /api/admin/finance
 *
 * All routes require authenticate + requireAdmin (applied in app.ts).
 *
 * GET  /summary                       — 12 finance KPIs
 * GET  /transactions                  — virtual ledger (paginated)
 * GET  /payouts                       — milestone payouts to contractors
 * POST /payouts/:payoutId/retry       — retry a failed Stripe transfer
 * GET  /failed-transactions           — cancelled escrows + stale approved milestones
 * POST /refund                        — issue a Stripe refund for a job
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import {
  getFinanceSummary,
  getTransactions,
  getPayouts,
  retryPayout,
  getFailedTransactions,
  issueRefund,
} from '../../services/admin/finance.service';
import { writeAuditLog } from '../../services/admin/audit.service';

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────────

const transactionsQuerySchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(25),
  type:       z.enum(['escrow_deposit', 'milestone_release', 'fee', 'refund', 'payout']).optional(),
  status:     z.string().optional(),
  dateFrom:   z.string().optional(),
  dateTo:     z.string().optional(),
  investorId: z.string().optional(),
});

const payoutsQuerySchema = z.object({
  status:       z.enum(['pending', 'processed', 'failed']).optional(),
  contractorId: z.string().optional(),
});

const refundBodySchema = z.object({
  jobId:  z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(5).max(500),
});

// ── GET /summary ───────────────────────────────────────────────────────────────

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const summary = await getFinanceSummary();
    sendSuccess(res, summary);
  } catch (err) {
    const msg = err instanceof AppError ? err.message : 'Failed to load finance summary';
    const code = err instanceof AppError ? err.statusCode : 500;
    sendError(res, msg, code);
  }
});

// ── GET /transactions ──────────────────────────────────────────────────────────

router.get('/transactions', async (req: Request, res: Response) => {
  const parsed = transactionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 'Invalid query parameters', 400);
    return;
  }

  try {
    const result = await getTransactions(parsed.data);
    sendSuccess(res, result);
  } catch (err) {
    const msg = err instanceof AppError ? err.message : 'Failed to load transactions';
    const code = err instanceof AppError ? err.statusCode : 500;
    sendError(res, msg, code);
  }
});

// ── GET /payouts ───────────────────────────────────────────────────────────────

router.get('/payouts', async (req: Request, res: Response) => {
  const parsed = payoutsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 'Invalid query parameters', 400);
    return;
  }

  try {
    const payouts = await getPayouts(parsed.data);
    sendSuccess(res, { payouts });
  } catch (err) {
    const msg = err instanceof AppError ? err.message : 'Failed to load payouts';
    const code = err instanceof AppError ? err.statusCode : 500;
    sendError(res, msg, code);
  }
});

// ── POST /payouts/:payoutId/retry ──────────────────────────────────────────────

router.post('/payouts/:payoutId/retry', async (req: Request, res: Response) => {
  const { payoutId } = req.params;
  const adminId = req.user!.userId;

  try {
    const result = await retryPayout(payoutId);

    void writeAuditLog({
      adminId,
      action:     'PAYMENT_RETRY',
      targetType: 'milestone',
      targetId:   payoutId,
      payload:    { stripeTransferId: result.stripeTransferId },
      ipAddress:  req.ip,
    });

    sendSuccess(res, result, 'Payout retry initiated');
  } catch (err) {
    const msg = err instanceof AppError ? err.message : 'Failed to retry payout';
    const code = err instanceof AppError ? err.statusCode : 500;
    sendError(res, msg, code);
  }
});

// ── GET /failed-transactions ───────────────────────────────────────────────────

router.get('/failed-transactions', async (_req: Request, res: Response) => {
  try {
    const items = await getFailedTransactions();
    sendSuccess(res, { items });
  } catch (err) {
    const msg = err instanceof AppError ? err.message : 'Failed to load failed transactions';
    const code = err instanceof AppError ? err.statusCode : 500;
    sendError(res, msg, code);
  }
});

// ── POST /refund ───────────────────────────────────────────────────────────────

router.post('/refund', async (req: Request, res: Response) => {
  const parsed = refundBodySchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    return;
  }

  const { jobId, amount, reason } = parsed.data;
  const adminId = req.user!.userId;

  try {
    const result = await issueRefund(jobId, amount, reason);

    void writeAuditLog({
      adminId,
      action:     'PAYMENT_REFUND',
      targetType: 'job',
      targetId:   jobId,
      payload:    { jobId, amount, reason, stripeRefundId: result.stripeRefundId },
      ipAddress:  req.ip,
    });

    sendSuccess(res, result, 'Refund issued successfully');
  } catch (err) {
    const msg = err instanceof AppError ? err.message : 'Failed to issue refund';
    const code = err instanceof AppError ? err.statusCode : 500;
    sendError(res, msg, code);
  }
});

export default router;
