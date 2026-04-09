import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  createSession, getStatus,
  getMobileSession, presignMobile, completeMobile,
} from '../controllers/id-verification.controller';

const router = Router();

// Desktop (authenticated) — create + poll handoff session
router.post('/session',        authenticate, createSession);
router.get('/session/status',  authenticate, getStatus);

// Mobile (token-authed via path param)
router.get('/m/:token',          getMobileSession);
router.post('/m/:token/presign', presignMobile);
router.post('/m/:token/complete', completeMobile);

export default router;
