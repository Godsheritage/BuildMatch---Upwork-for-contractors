import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { onboard, connectStatus, handleWebhook } from '../controllers/stripe.controller';

const router = Router();

// Webhook — must use raw body; express.raw() is applied at the app level for this path
router.post('/webhooks', handleWebhook);

// Connect onboarding
router.post('/connect/onboard', authenticate, requireRole('CONTRACTOR'), onboard);
router.get('/connect/status',   authenticate, requireRole('CONTRACTOR'), connectStatus);

export default router;
