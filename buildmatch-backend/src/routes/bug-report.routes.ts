import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuthenticate } from '../middleware/auth.middleware';
import { submitBugReport } from '../controllers/bug-report.controller';

const router = Router();

export const bugReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many reports. Please try again later.' },
});

router.post('/', bugReportLimiter, optionalAuthenticate, submitBugReport);

export default router;
