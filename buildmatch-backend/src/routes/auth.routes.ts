import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register, login, getMe,
  googleAuth, linkGoogle, unlinkGoogle,
  forgotPassword, verifyResetToken, resetPassword,
  requestEmailVerification, confirmEmailVerification, submitIdDocument,
} from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import {
  registerSchema, loginSchema,
  forgotPasswordSchema, resetPasswordSchema,
} from '../schemas/auth.schemas';

const router = Router();

// Tight per-route limiter to deter abuse / enumeration scans of /forgot-password.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      5,              // 5 requests per IP per window
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, message: 'Too many requests. Please try again later.' },
});

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/google', googleAuth);
router.get('/me', authenticate, getMe);

router.post('/google/link',   authenticate, linkGoogle);
router.post('/google/unlink', authenticate, unlinkGoogle);

router.post('/forgot-password',        forgotPasswordLimiter, validate(forgotPasswordSchema), forgotPassword);
router.get('/reset-password/verify',   verifyResetToken);
router.post('/reset-password',         validate(resetPasswordSchema), resetPassword);

router.post('/email/verify/request',   authenticate, requestEmailVerification);
router.post('/email/verify/confirm',   confirmEmailVerification);
router.post('/identity/document',      authenticate, submitIdDocument);

export default router;
