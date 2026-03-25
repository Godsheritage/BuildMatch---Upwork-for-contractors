import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import contractorRoutes from './routes/contractor.routes';
import jobRoutes from './routes/job.routes';
import { errorHandler } from './middleware/error.middleware';

dotenv.config();

const app = express();

// Security headers
app.use(helmet());

// CORS — only allow configured frontend origin
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

// Rate limiting — 100 requests per 15 minutes per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

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

// Global error handler — must be last
app.use(errorHandler);

export default app;
