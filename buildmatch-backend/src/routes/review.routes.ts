import { Router } from 'express';
import {
  completeJob,
  createReview,
  listContractorReviews,
  listJobReviews,
} from '../controllers/review.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createReviewSchema } from '../schemas/review.schemas';

const router = Router();

// POST /api/jobs/:jobId/complete
router.post(
  '/jobs/:jobId/complete',
  authenticate,
  requireRole('INVESTOR'),
  completeJob,
);

// POST /api/jobs/:jobId/reviews
router.post(
  '/jobs/:jobId/reviews',
  authenticate,
  validate(createReviewSchema),
  createReview,
);

// GET /api/jobs/:jobId/reviews
router.get(
  '/jobs/:jobId/reviews',
  authenticate,
  listJobReviews,
);

// GET /api/contractors/:contractorId/reviews
router.get(
  '/contractors/:contractorId/reviews',
  listContractorReviews,
);

export default router;
