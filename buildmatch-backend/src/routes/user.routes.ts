import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateAvatarSchema, updateProfileSchema } from '../schemas/user.schemas';
import {
  updateAvatar, deleteAvatar, updateProfile,
  getNotificationPrefs, updateNotificationPrefs,
} from '../controllers/user.controller';

const router = Router();

router.put('/me',           authenticate, validate(updateProfileSchema), updateProfile);
router.put('/me/avatar',    authenticate, validate(updateAvatarSchema),  updateAvatar);
router.delete('/me/avatar', authenticate, deleteAvatar);

router.get('/me/notification-preferences', authenticate, getNotificationPrefs);
router.put('/me/notification-preferences', authenticate, updateNotificationPrefs);

export default router;
