import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { requestTestimonialSchema, submitTestimonialSchema } from '../schemas/testimonial.schemas';
import {
  requestTestimonial,
  getTestimonialRequest,
  submitTestimonial,
  listContractorTestimonials,
} from '../controllers/testimonial.controller';

const router = Router();

// Contractor requests a testimonial from someone (auth required)
router.post(
  '/contractors/:contractorId/testimonial-requests',
  authenticate,
  requireRole('CONTRACTOR'),
  validate(requestTestimonialSchema),
  requestTestimonial,
);

// List testimonials for a contractor (public)
router.get('/contractors/:contractorId/testimonials', listContractorTestimonials);

// Get request info by token — public (recipient's form page)
router.get('/testimonials/:token', getTestimonialRequest);

// Submit testimonial by token — public (no auth needed)
router.post('/testimonials/:token', validate(submitTestimonialSchema), submitTestimonial);

export default router;
