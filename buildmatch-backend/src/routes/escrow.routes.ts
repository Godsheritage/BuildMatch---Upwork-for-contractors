import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  fundJobSchema,
  submitMilestoneSchema,
  disputeMilestoneSchema,
  resolveDisputeSchema,
} from '../schemas/escrow.schemas';
import {
  fundJobHandler,
  getEscrowHandler,
  submitMilestoneHandler,
  approveMilestoneHandler,
  disputeMilestoneHandler,
  resolveDisputeHandler,
} from '../controllers/escrow.controller';

const router = Router();

// Fund a job — creates EscrowPayment + Stripe PaymentIntent
router.post(
  '/fund-job/:jobId',
  authenticate, requireRole('INVESTOR'),
  validate(fundJobSchema),
  fundJobHandler,
);

// Get escrow details — investor or awarded contractor
router.get('/:jobId', authenticate, getEscrowHandler);

// Milestone actions — ordered before /:jobId param routes would conflict
router.post(
  '/:jobId/milestones/:milestoneId/submit',
  authenticate, requireRole('CONTRACTOR'),
  validate(submitMilestoneSchema),
  submitMilestoneHandler,
);

router.post(
  '/:jobId/milestones/:milestoneId/approve',
  authenticate, requireRole('INVESTOR'),
  approveMilestoneHandler,
);

router.post(
  '/:jobId/milestones/:milestoneId/dispute',
  authenticate, requireRole('INVESTOR'),
  validate(disputeMilestoneSchema),
  disputeMilestoneHandler,
);

router.post(
  '/:jobId/milestones/:milestoneId/resolve-dispute',
  authenticate, requireRole('ADMIN'),
  validate(resolveDisputeSchema),
  resolveDisputeHandler,
);

export default router;
