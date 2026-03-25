import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response.utils';

const router = Router();

// Placeholder — expand as user management features are added
router.get('/profile', authenticate, (req, res) => {
  sendSuccess(res, { userId: req.user?.userId });
});

export default router;
