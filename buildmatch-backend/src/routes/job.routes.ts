import { Router } from 'express';
import { getAll, getById, create } from '../controllers/job.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createJobSchema } from '../schemas/job.schemas';

const router = Router();

router.get('/', getAll);
router.get('/:id', getById);
router.post('/', authenticate, validate(createJobSchema), create);

export default router;
