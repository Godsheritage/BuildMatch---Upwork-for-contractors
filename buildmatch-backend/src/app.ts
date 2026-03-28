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
import notificationRoutes from './routes/notification.routes';
import stripeRoutes from './routes/stripe.routes';
import escrowRoutes from './routes/escrow.routes';
import reviewRoutes from './routes/review.routes';
import messageRoutes from './routes/message.routes';
import uploadRoutes from './routes/upload.routes';
import { errorHandler } from './middleware/error.middleware';

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
// Mount /api/ai/matching before /api/ai so Express never passes /matching/* into aiRoutes
app.use('/api/ai/matching', aiMatchingRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

// Global error handler — must be last
app.use(errorHandler);

export default app;
