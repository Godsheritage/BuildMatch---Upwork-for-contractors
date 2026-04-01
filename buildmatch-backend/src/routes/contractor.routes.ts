import { Router } from 'express';
import { getAll, getById, getMyProfile, updateMyProfile } from '../controllers/contractor.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateContractorProfileSchema } from '../schemas/contractor.schemas';

const router = Router();

// Authenticated routes — must come before /:id to avoid being swallowed by the param route
router.get('/me', authenticate, requireRole('CONTRACTOR'), getMyProfile);
router.put(
  '/me',
  authenticate,
  requireRole('CONTRACTOR'),
  validate(updateContractorProfileSchema),
  updateMyProfile,
);

// Public
router.get('/', getAll);
router.get('/:id', getById);

export default router;
