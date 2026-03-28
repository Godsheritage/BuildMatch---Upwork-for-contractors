import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { analyzeBids, ValidationError } from '../../services/ai/bid-analyzer.service';
import prisma from '../../lib/prisma';

const router = Router();

// ── Rate limiter ──────────────────────────────────────────────────────────────
// 10 per user per hour — this is an expensive Opus call.

const analysisRateLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  handler:         (_req: Request, res: Response) => {
    sendError(res, 'Too many analysis requests. Please try again later.', 429);
  },
});

// ── GET /:jobId/analysis ──────────────────────────────────────────────────────

router.get(
  '/:jobId/analysis',
  authenticate,
  requireRole('INVESTOR'),
  analysisRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    if (!jobId || jobId.trim().length < 10) {
      sendError(res, 'Invalid job ID', 400);
      return;
    }

    // Verify ownership and minimum bid count before hitting the service
    try {
      const job = await prisma.job.findUnique({
        where:  { id: jobId },
        select: { investorId: true },
      });

      if (!job) {
        sendError(res, 'Job not found', 404);
        return;
      }

      if (job.investorId !== req.user!.userId) {
        sendError(res, 'You do not have access to this job', 403);
        return;
      }

      const bidCount = await prisma.bid.count({
        where: { jobId, status: { in: ['PENDING', 'ACCEPTED'] } },
      });

      if (bidCount < 2) {
        sendError(res, 'At least 2 bids are required to run analysis', 400);
        return;
      }

      const analysis = await analyzeBids({ jobId, investorId: req.user!.userId });

      // Graceful 503 if AI returned the fallback (summary signals unavailability)
      if (analysis.summary === 'Analysis temporarily unavailable') {
        sendError(res, 'AI bid analysis temporarily unavailable. Please try again shortly.', 503);
        return;
      }

      sendSuccess(res, analysis);

    } catch (err) {
      if (err instanceof ValidationError) {
        sendError(res, err.message, 400);
        return;
      }
      if (err instanceof AppError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      console.error('[bid-analyzer.routes] GET error:', err);
      sendError(res, 'AI bid analysis temporarily unavailable. Please try again shortly.', 503);
    }
  },
);

export default router;
