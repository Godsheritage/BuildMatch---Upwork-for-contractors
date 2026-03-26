import { Router } from 'express';
import { handleChat, polishReply, summarizeThread, classifyPreview } from '../controllers/ai.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { polishReplySchema } from '../schemas/ai.schemas';

const router = Router();

// Public — optional auth for chat, no auth for classify preview
router.post('/chat',             optionalAuthenticate, handleChat);
router.post('/classify-preview', classifyPreview);

// Protected — any authenticated user
router.post('/polish-reply',        authenticate, validate(polishReplySchema), polishReply);
router.post('/summarize/:jobId',    authenticate, summarizeThread);

export default router;
