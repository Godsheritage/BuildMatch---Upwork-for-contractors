import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import {
  generateFollowUpQuestions,
  generateJobDescription,
  AiServiceError,
} from '../../services/ai/job-assistant.service';

const router = Router();

// All routes require authentication and INVESTOR role
router.use(authenticate, requireRole('INVESTOR'));

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Keyed by userId — authenticate runs first so req.user is always set here.

const questionsRateLimiter = rateLimit({
  windowMs:       60 * 60 * 1000, // 1 hour
  max:            30,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:   (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  handler:        (_req: Request, res: Response) => {
    sendError(res, 'Too many requests. Please try again later.', 429);
  },
});

const generateRateLimiter = rateLimit({
  windowMs:       60 * 60 * 1000, // 1 hour
  max:            20,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:   (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  handler:        (_req: Request, res: Response) => {
    sendError(res, 'Too many requests. Please try again later.', 429);
  },
});

// ── Validation schemas ────────────────────────────────────────────────────────

const TRADE_TYPES = [
  'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC',
  'ROOFING', 'FLOORING', 'PAINTING', 'LANDSCAPING',
  'DEMOLITION', 'OTHER',
] as const;

const questionsSchema = z.object({
  roughDescription: z.string().min(20, 'Description must be at least 20 characters').max(500, 'Description must be 500 characters or fewer'),
  tradeType:        z.enum(TRADE_TYPES),
});

const generateSchema = z.object({
  roughDescription: z.string().min(20, 'Description must be at least 20 characters').max(500, 'Description must be 500 characters or fewer'),
  tradeType:        z.enum(TRADE_TYPES),
  answers:          z.array(z.object({
    question: z.string(),
    answer:   z.string(),
  })).min(1, 'At least one answer is required'),
  budgetMin: z.number().positive('Budget minimum must be a positive number'),
  budgetMax: z.number().positive('Budget maximum must be a positive number'),
  city:      z.string().min(1, 'City is required'),
  state:     z.string().min(1, 'State is required'),
}).refine((d) => d.budgetMax > d.budgetMin, {
  message: 'Budget maximum must be greater than budget minimum',
  path:    ['budgetMax'],
});

// ── POST /questions ───────────────────────────────────────────────────────────

router.post(
  '/questions',
  questionsRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = questionsSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }

    try {
      const result = await generateFollowUpQuestions({
        ...parsed.data,
        userId: req.user!.userId,
      });
      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof AiServiceError) {
        sendError(res, 'AI assistant temporarily unavailable. You can still write your description manually.', 503);
        return;
      }
      console.error('[job-assistant.routes] POST /questions error:', err);
      sendError(res, 'An unexpected error occurred', 500);
    }
  },
);

// ── POST /generate ────────────────────────────────────────────────────────────

router.post(
  '/generate',
  generateRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }

    try {
      const result = await generateJobDescription({
        ...parsed.data,
        userId: req.user!.userId,
      });
      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof AiServiceError) {
        sendError(res, 'AI assistant temporarily unavailable. You can still write your description manually.', 503);
        return;
      }
      console.error('[job-assistant.routes] POST /generate error:', err);
      sendError(res, 'An unexpected error occurred', 500);
    }
  },
);

export default router;
