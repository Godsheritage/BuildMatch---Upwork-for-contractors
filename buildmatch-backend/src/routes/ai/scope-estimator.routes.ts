import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import {
  estimateScopeFromPhotos,
  fallbackEstimate,
  type ScopeEstimate,
} from '../../services/ai/scope-estimator.service';

const router = Router();

// ── Constants ──────────────────────────────────────────────────────────────────

const ROUTE_TIMEOUT_MS = 30_000;

// ── Rate limiter — 10 scope estimates per user per day ─────────────────────────
// Vision API calls are expensive; enforce a hard daily cap per authenticated user.

const scopeRateLimiter = rateLimit({
  windowMs:        24 * 60 * 60 * 1000, // 24 hours
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  // authenticate runs before this middleware, so req.user is always set here
  keyGenerator:    (req: Request) => `scope:${req.user?.userId ?? req.ip ?? 'anon'}`,
  handler:         (_req: Request, res: Response) => {
    sendError(
      res,
      'Daily photo analysis limit reached. You can still fill in the job details manually.',
      429,
    );
  },
  skip: () => false,
});

// ── Body schema ────────────────────────────────────────────────────────────────

const TRADE_TYPES = [
  'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC',
  'ROOFING', 'FLOORING', 'PAINTING', 'LANDSCAPING',
  'DEMOLITION', 'OTHER',
] as const;

const bodySchema = z.object({
  photoUrls: z
    .array(z.string().url('Each photoUrl must be a valid URL'))
    .min(1, 'At least one photo URL is required')
    .max(5, 'Maximum 5 photo URLs allowed'),
  tradeType: z.enum(TRADE_TYPES),
  city:      z.string().min(1).max(100),
  state:     z.string().min(1).max(50),
});

// ── URL whitelist helper ───────────────────────────────────────────────────────
// Prevents abuse by ensuring every URL belongs to the project's Supabase bucket.

function allUrlsAreTrusted(urls: string[]): boolean {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return true; // skip validation in environments without the var
  const storagePrefix = `${supabaseUrl}/storage/v1/object/`;
  return urls.every((url) => url.startsWith(storagePrefix));
}

// ── POST / ────────────────────────────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  requireRole('INVESTOR'),
  scopeRateLimiter,
  validate(bodySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { photoUrls, tradeType, city, state } = req.body as z.infer<typeof bodySchema>;
    const userId = req.user!.userId;

    // Guard: reject URLs that don't point to the project's own storage
    if (!allUrlsAreTrusted(photoUrls)) {
      sendError(res, 'Photo URLs must point to BuildMatch storage', 422);
      return;
    }

    // Race the service call against a 30-second wall-clock timeout.
    // The timeout branch returns a graceful fallback so the response is never a 500.
    let result: ScopeEstimate;
    try {
      result = await Promise.race<ScopeEstimate>([
        estimateScopeFromPhotos({ photoUrls, tradeType, city, state, userId }),
        new Promise<ScopeEstimate>((resolve) =>
          setTimeout(() => {
            console.warn('[scope-estimator.routes] 30s timeout — returning fallback');
            resolve(fallbackEstimate());
          }, ROUTE_TIMEOUT_MS),
        ),
      ]);
    } catch {
      // estimateScopeFromPhotos never throws, but defend anyway
      result = fallbackEstimate();
    }

    sendSuccess(res, result);
  },
);

export default router;
