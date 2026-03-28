import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import prisma from '../../lib/prisma';
import { getMatchedContractors } from '../../services/ai/matching.service';

const router = Router();

// ── Rate limiter ──────────────────────────────────────────────────────────────
// 20 requests per user per hour. Matching calls Anthropic — keep it intentional.
// Keyed by userId so one investor can't exhaust the quota for another.

const matchingRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  // authenticate runs before this middleware, so req.user is always set here
  keyGenerator: (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  handler: (_req: Request, res: Response) => {
    sendError(res, 'Too many matching requests. Please try again later.', 429);
  },
  skip: () => false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Verify the authenticated user owns the job. Returns the job or sends the error response. */
async function authorizeJobOwner(
  req: Request,
  res: Response,
  jobId: string,
): Promise<{ investorId: string; status: string } | null> {
  const job = await prisma.job.findUnique({
    where:  { id: jobId },
    select: { investorId: true, status: true },
  });

  if (!job) {
    sendError(res, 'Job not found', 404);
    return null;
  }

  if (job.investorId !== req.user!.userId) {
    sendError(res, 'You do not have access to this job', 403);
    return null;
  }

  return job;
}

// ── GET /:jobId ───────────────────────────────────────────────────────────────
// Returns AI-ranked contractor matches for a job.
// Protected: must be authenticated and own the job.
// Rate limited: 20 per user per hour.

router.get(
  '/:jobId',
  authenticate,
  matchingRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    // jobId sanity check — project uses CUIDs (not UUIDs), so just validate length
    if (!jobId || jobId.trim().length < 10) {
      sendError(res, 'Invalid job ID', 400);
      return;
    }

    try {
      const job = await authorizeJobOwner(req, res, jobId);
      if (!job) return; // error already sent

      const result = await getMatchedContractors(jobId, req.user!.userId);
      sendSuccess(res, result);
    } catch (err) {
      // Surface legitimate 404s (job not found / not OPEN in service layer)
      if (err instanceof AppError && err.statusCode === 404) {
        sendError(res, err.message, 404);
        return;
      }
      console.error('[matching.routes] GET error:', err);
      sendError(res, 'Matching temporarily unavailable', 503);
    }
  },
);

// ── DELETE /:jobId/cache ──────────────────────────────────────────────────────
// Invalidates the cached match results for a job.
// Call this after the investor edits a job so the next GET fetches fresh results.
// Protected: must be authenticated and own the job. No rate limit (cheap DB op).

router.delete(
  '/:jobId/cache',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { jobId } = req.params;

    if (!jobId || jobId.trim().length < 10) {
      sendError(res, 'Invalid job ID', 400);
      return;
    }

    try {
      const job = await authorizeJobOwner(req, res, jobId);
      if (!job) return; // error already sent

      // deleteMany silently succeeds if no cache row exists (avoids 404 on a missing cache)
      await prisma.matchingCache.deleteMany({ where: { jobId } });
      sendSuccess(res, null, 'Matching cache cleared');
    } catch (err) {
      console.error('[matching.routes] DELETE cache error:', err);
      sendError(res, 'Failed to clear matching cache', 500);
    }
  },
);

export default router;
