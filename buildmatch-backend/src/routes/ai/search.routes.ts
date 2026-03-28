import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { optionalAuthenticate } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { searchContractors } from '../../services/ai/contractor-search.service';

const router = Router();

// ── Rate limiter ──────────────────────────────────────────────────────────────
// 10 requests per 15 minutes per IP. Public endpoint — keyed by IP.

const searchRateLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:   (req: Request) => req.ip ?? 'unknown',
  handler:        (_req: Request, res: Response) => {
    sendError(res, 'Too many search requests. Please try again in a few minutes.', 429);
  },
});

// ── Body schema ───────────────────────────────────────────────────────────────

const searchSchema = z.object({
  query: z.string().min(10, 'Query must be at least 10 characters').max(500, 'Query must be 500 characters or fewer'),
});

// ── POST / ────────────────────────────────────────────────────────────────────

router.post(
  '/',
  searchRateLimiter,
  optionalAuthenticate,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }

    try {
      const result = await searchContractors(parsed.data.query, req.user?.userId);
      sendSuccess(res, result);
    } catch (err) {
      console.error('[search.routes] POST error:', err);
      sendError(res, 'Search temporarily unavailable', 503);
    }
  },
);

export default router;
