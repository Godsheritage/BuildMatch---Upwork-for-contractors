import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateAvatarSchema } from '../schemas/user.schemas';
import { updateAvatar, deleteAvatar } from '../controllers/user.controller';

const router = Router();

router.put('/me/avatar',    authenticate, validate(updateAvatarSchema), updateAvatar);
router.delete('/me/avatar', authenticate, deleteAvatar);

export default router;
