import { Router } from 'express';
import {
  createConversation,
  listConversations,
  getConversation,
  getUnreadCount,
  sendConversationMessage,
  getConversationMessages,
} from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

// All message routes require authentication
router.use(authenticate);

// ── Schema ────────────────────────────────────────────────────────────────────

const createConversationSchema = z.object({
  jobId:       z.string().min(1, 'jobId is required'),
  recipientId: z.string().min(1, 'recipientId is required'),
});

const sendMessageSchema = z.object({
  content: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long')),
});

// ── Routes ────────────────────────────────────────────────────────────────────
// NOTE: static segments (/unread-count) declared before dynamic params (:conversationId)

router.get('/conversations/unread-count',                       getUnreadCount);
router.get('/conversations/:conversationId/messages',           getConversationMessages);
router.post('/conversations/:conversationId/messages', validate(sendMessageSchema), sendConversationMessage);
router.get('/conversations/:conversationId',                    getConversation);
router.get('/conversations',                                    listConversations);
router.post('/conversations', validate(createConversationSchema), createConversation);

export default router;
