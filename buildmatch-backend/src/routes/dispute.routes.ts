import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.middleware';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import {
  fileDispute,
  getUserDisputes,
  getDisputeById,
  getDisputeMessages,
  addDisputeMessage,
  submitEvidence,
  getDisputeEvidence,
  withdrawDispute,
  getDisputeSummary,
} from '../services/dispute.service';
import type { DisputeStatus } from '../types/dispute.types';

const router = Router();

// All dispute routes require authentication
router.use(authenticate);

// ── Rate limiters ─────────────────────────────────────────────────────────────

/** 5 new disputes per user per day */
const fileDisputeLimiter = rateLimit({
  windowMs:        24 * 60 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req: Request) => req.user?.userId ?? req.ip ?? 'anon',
  handler:         (_req: Request, res: Response) => {
    sendError(res, 'You can file at most 5 disputes per day. Please try again tomorrow.', 429);
  },
});

/** 30 messages per user per hour — keyed by userId:disputeId */
const messageLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req: Request) =>
    `${req.user?.userId ?? 'anon'}:${req.params.disputeId ?? ''}`,
  handler:         (_req: Request, res: Response) => {
    sendError(res, 'Message limit reached. Please wait before sending more.', 429);
  },
});

// ── Validation schemas ────────────────────────────────────────────────────────

const DISPUTE_CATEGORIES = [
  'INCOMPLETE_WORK',
  'WORK_NOT_STARTED',
  'QUALITY_ISSUES',
  'TIMELINE_BREACH',
  'PAYMENT_DISPUTE',
  'SCOPE_CREEP',
  'COMMUNICATION_BREAKDOWN',
  'OTHER',
] as const;

const EVIDENCE_TYPES = [
  'PHOTO',
  'VIDEO',
  'DOCUMENT',
  'SCREENSHOT',
  'OTHER',
] as const;

const EVIDENCE_URL_REQUIRED: (typeof EVIDENCE_TYPES)[number][] = ['PHOTO', 'VIDEO', 'DOCUMENT'];

const fileDisputeSchema = z.object({
  jobId:          z.string().min(1, 'jobId is required'),
  milestoneDraw:  z.number().int().min(1).optional(),
  amountDisputed: z.number().positive('amountDisputed must be a positive number'),
  category:       z.enum(DISPUTE_CATEGORIES),
  description:    z.string().min(50, 'Description must be at least 50 characters').max(2000),
  desiredOutcome: z.string().min(20, 'Desired outcome must be at least 20 characters').max(500),
});

const addMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000),
});

const evidenceSchema = z.object({
  type:        z.enum(EVIDENCE_TYPES),
  url:         z.string().url('url must be a valid URL').optional(),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500),
}).superRefine((data, ctx) => {
  if (
    EVIDENCE_URL_REQUIRED.includes(data.type as typeof EVIDENCE_URL_REQUIRED[number]) &&
    !data.url
  ) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      message: `url is required for evidence type ${data.type}`,
      path:    ['url'],
    });
  }
  if (
    data.url &&
    !data.url.includes('/storage/v1/object/') &&
    !data.url.includes('dispute-evidence')
  ) {
    ctx.addIssue({
      code:    z.ZodIssueCode.custom,
      message: 'url must point to the Supabase dispute-evidence storage bucket',
      path:    ['url'],
    });
  }
});

const withdrawSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason of at least 10 characters').max(300),
});

const listQuerySchema = z.object({
  status: z.enum([
    'UNDER_REVIEW', 'AWAITING_EVIDENCE',
    'PENDING_RULING', 'RESOLVED', 'CLOSED', 'WITHDRAWN',
  ] as const).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(25).default(10),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// NOTE: /summary must be declared before /:disputeId to avoid param capture
// GET /api/disputes/summary
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const summary = await getDisputeSummary(req.user!.userId);
    sendSuccess(res, summary);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[disputes] GET /summary error:', err);
    sendError(res, 'An unexpected error occurred', 500);
  }
});

// POST /api/disputes
router.post(
  '/',
  fileDisputeLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = fileDisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }
    try {
      const dispute = await fileDispute(parsed.data, req.user!.userId);
      sendSuccess(res, dispute, 'Dispute filed successfully', 201);
    } catch (err) {
      if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
      console.error('[disputes] POST / error:', err);
      sendError(res, 'An unexpected error occurred', 500);
    }
  },
);

// GET /api/disputes
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  try {
    const result = await getUserDisputes(req.user!.userId, {
      status: parsed.data.status as DisputeStatus | undefined,
      page:   parsed.data.page,
      limit:  parsed.data.limit,
    });
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[disputes] GET / error:', err);
    sendError(res, 'An unexpected error occurred', 500);
  }
});

// GET /api/disputes/:disputeId
router.get('/:disputeId', async (req: Request, res: Response): Promise<void> => {
  try {
    const dispute = await getDisputeById(req.params.disputeId, req.user!.userId);
    sendSuccess(res, dispute);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[disputes] GET /:id error:', err);
    sendError(res, 'An unexpected error occurred', 500);
  }
});

// GET /api/disputes/:disputeId/messages
router.get('/:disputeId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const messages = await getDisputeMessages(req.params.disputeId, req.user!.userId);
    sendSuccess(res, { messages });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[disputes] GET /:id/messages error:', err);
    sendError(res, 'An unexpected error occurred', 500);
  }
});

// POST /api/disputes/:disputeId/messages
router.post(
  '/:disputeId/messages',
  messageLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = addMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
      return;
    }
    try {
      const message = await addDisputeMessage(
        req.params.disputeId,
        req.user!.userId,
        parsed.data.content,
      );
      sendSuccess(res, message, undefined, 201);
    } catch (err) {
      if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
      console.error('[disputes] POST /:id/messages error:', err);
      sendError(res, 'An unexpected error occurred', 500);
    }
  },
);

// GET /api/disputes/:disputeId/evidence
router.get('/:disputeId/evidence', async (req: Request, res: Response): Promise<void> => {
  try {
    const evidence = await getDisputeEvidence(req.params.disputeId, req.user!.userId);
    sendSuccess(res, { evidence });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[disputes] GET /:id/evidence error:', err);
    sendError(res, 'An unexpected error occurred', 500);
  }
});

// POST /api/disputes/:disputeId/evidence
router.post('/:disputeId/evidence', async (req: Request, res: Response): Promise<void> => {
  const parsed = evidenceSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
    return;
  }
  try {
    const evidence = await submitEvidence(
      req.params.disputeId,
      req.user!.userId,
      parsed.data,
    );
    sendSuccess(res, evidence, undefined, 201);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[disputes] POST /:id/evidence error:', err);
    sendError(res, 'An unexpected error occurred', 500);
  }
});

// POST /api/disputes/:disputeId/withdraw
router.post('/:disputeId/withdraw', async (req: Request, res: Response): Promise<void> => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request', 400);
    return;
  }
  try {
    await withdrawDispute(req.params.disputeId, req.user!.userId, parsed.data.reason);
    sendSuccess(res, null, 'Dispute withdrawn successfully');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[disputes] POST /:id/withdraw error:', err);
    sendError(res, 'An unexpected error occurred', 500);
  }
});

export default router;
