import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateAvatarSchema, updateProfileSchema } from '../schemas/user.schemas';
import { updateAvatar, deleteAvatar, updateProfile } from '../controllers/user.controller';

const router = Router();

router.put('/me',           authenticate, validate(updateProfileSchema), updateProfile);
router.put('/me/avatar',    authenticate, validate(updateAvatarSchema),  updateAvatar);
router.delete('/me/avatar', authenticate, deleteAvatar);

export default router;
