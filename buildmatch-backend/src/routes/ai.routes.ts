import { Router } from 'express';
import { handleChat } from '../controllers/ai.controller';
import { optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

// Optional auth — works for both guests and logged-in users
router.post('/chat', optionalAuthenticate, handleChat);

export default router;
