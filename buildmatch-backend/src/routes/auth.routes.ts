import { Router } from 'express';
import {
  register, login, getMe,
  googleAuth, linkGoogle, unlinkGoogle,
} from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { registerSchema, loginSchema } from '../schemas/auth.schemas';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/google', googleAuth);
router.get('/me', authenticate, getMe);

router.post('/google/link',   authenticate, linkGoogle);
router.post('/google/unlink', authenticate, unlinkGoogle);

export default router;
