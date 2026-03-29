import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import contractorRoutes from './routes/contractor.routes';
import jobRoutes from './routes/job.routes';
import aiRoutes from './routes/ai.routes';
import aiMatchingRoutes from './routes/ai/matching.routes';
import aiSearchRoutes from './routes/ai/search.routes';
import aiJobAssistantRoutes from './routes/ai/job-assistant.routes';
import aiBidAnalyzerRoutes from './routes/ai/bid-analyzer.routes';
import aiReliabilityRoutes from './routes/ai/reliability.routes';
import aiScopeEstimatorRoutes from './routes/ai/scope-estimator.routes';
import aiParseJobRoutes from './routes/ai/parse-job.routes';
import notificationRoutes from './routes/notification.routes';
import stripeRoutes from './routes/stripe.routes';
import escrowRoutes from './routes/escrow.routes';
import reviewRoutes from './routes/review.routes';
import messageRoutes from './routes/message.routes';
import uploadRoutes from './routes/upload.routes';
import contractRoutes from './routes/contracts.routes';
import disputeRoutes from './routes/dispute.routes';
import adminRouter from './routes/admin/index';
import savedRoutes from './routes/saved.routes';
import { errorHandler } from './middleware/error.middleware';
import { authenticate, requireRole } from './middleware/auth.middleware';
import { sendSuccess, sendError } from './utils/response.utils';
import { computeAllReliabilityScores } from './services/ai/reliability-score.service';

dotenv.config();

const app = express();

// Security headers
app.use(helmet());

// CORS — allow configured frontend origin (and any localhost port in dev)
const allowedOrigin = process.env.FRONTEND_URL ?? 'http://localhost:5173';
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser requests (curl, Postman)
      const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
      if (origin === allowedOrigin || isLocalhost) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Rate limiting — 500 requests per 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Raw body for Stripe webhook signature verification — must come before express.json()
app.use('/api/stripe/webhooks', express.raw({ type: 'application/json' }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/jobs', jobRoutes);
// ── AI feature flag ───────────────────────────────────────────────────────────
// Set AI_ENABLED=false in env to disable every /api/ai/* route globally.
// Must be registered before all specific /api/ai/* mounts.
app.use('/api/ai', (_req, res, next) => {
  if (process.env.AI_ENABLED === 'false') {
    sendError(res, 'AI features are currently disabled', 503);
    return;
  }
  next();
});

// Mount specific /api/ai/* prefixes before /api/ai so Express never passes them into aiRoutes
app.use('/api/ai/matching', aiMatchingRoutes);
app.use('/api/ai/search', aiSearchRoutes);
app.use('/api/ai/job-assistant', aiJobAssistantRoutes);
app.use('/api/ai/bids', aiBidAnalyzerRoutes);
app.use('/api/ai/reliability', aiReliabilityRoutes);
app.use('/api/ai/scope-estimate', aiScopeEstimatorRoutes);
app.use('/api/ai/parse-job', aiParseJobRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/disputes', disputeRoutes);
// ── Admin routes ─────────────────────────────────────────────────────────────
// authenticate + requireAdmin applied once in src/routes/admin/index.ts.
// Sub-routers must NOT re-apply those middleware layers.
app.use('/api/admin', adminRouter);
app.use('/api/saved', savedRoutes);

// ── Admin endpoints ──────────────────────────────────────────────────────────
// POST /api/admin/reliability/recompute-all — triggers batch score computation
app.post(
  '/api/admin/reliability/recompute-all',
  authenticate,
  requireRole('ADMIN'),
  (_req, res) => {
    // Fire-and-forget — do not await so the response returns immediately
    computeAllReliabilityScores().catch((err) =>
      console.error('[admin] reliability recompute-all error:', err),
    );
    sendSuccess(res, { started: true }, 'Reliability score recomputation started');
  },
);

// Global error handler — must be last
app.use(errorHandler);

export default app;
