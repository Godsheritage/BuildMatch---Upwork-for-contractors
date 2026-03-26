import { Router } from 'express';
import { getNotifications } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, getNotifications);

export default router;
