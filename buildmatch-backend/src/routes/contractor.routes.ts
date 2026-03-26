import { Router } from 'express';
import { getAll, getById, updateMyProfile } from '../controllers/contractor.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateContractorProfileSchema } from '../schemas/contractor.schemas';

const router = Router();

// Public
router.get('/', getAll);
router.get('/:id', getById);

// CONTRACTOR only — must come before /:id to avoid being swallowed by the param route
router.put(
  '/me',
  authenticate,
  requireRole('CONTRACTOR'),
  validate(updateContractorProfileSchema),
  updateMyProfile,
);

export default router;
