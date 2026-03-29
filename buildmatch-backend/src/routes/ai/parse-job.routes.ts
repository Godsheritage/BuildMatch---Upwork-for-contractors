import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { parseJobDescription, ParseJobError } from '../../services/ai/parse-job.service';

const router = Router();

router.use(authenticate, requireRole('INVESTOR'));

const parseRateLimiter = rateLimit({
  windowMs:        60 * 60 * 1000, // 1 hour
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  handler:         (_req: Request, res: Response) => {
    sendError(res, 'Too many requests. Please try again later.', 429);
  },
});

const parseSchema = z.object({
  text: z
    .string()
    .min(20, 'Please describe your project in at least 20 characters.')
    .max(1000, 'Description must be 1000 characters or fewer.'),
});

// POST /api/ai/parse-job
router.post(
  '/',
  parseRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = parseSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }

    try {
      const result = await parseJobDescription({
        text:   parsed.data.text,
        userId: req.user!.userId,
      });
      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof ParseJobError) {
        sendError(res, 'AI parsing temporarily unavailable. Please fill in the form manually.', 503);
        return;
      }
      console.error('[parse-job.routes] error:', err);
      sendError(res, 'An unexpected error occurred', 500);
    }
  },
);

export default router;
