import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { waitlistSchema } from '../schemas/waitlist.schemas';
import { joinWaitlist } from '../controllers/waitlist.controller';

const router = Router();

router.post('/', validate(waitlistSchema), joinWaitlist);

export default router;
