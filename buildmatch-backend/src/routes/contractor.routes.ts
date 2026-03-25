import { Router } from 'express';
import { getAll, getById, upsertProfile } from '../controllers/contractor.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { contractorProfileSchema } from '../schemas/contractor.schemas';

const router = Router();

router.get('/', getAll);
router.get('/:id', getById);
router.put('/profile', authenticate, validate(contractorProfileSchema), upsertProfile);

export default router;
