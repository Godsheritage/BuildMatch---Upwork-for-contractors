import { Router } from 'express';
import {
  createConversation,
  listConversations,
  getConversation,
  getUnreadCount,
  sendConversationMessage,
  getConversationMessages,
  editConversationMessage,
  deleteConversationMessage,
  reportConversationMessage,
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
  replyToId: z.string().optional(),
});

const editMessageSchema = z.object({
  content: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long')),
});

const reportMessageSchema = z.object({
  reason:      z.string().min(1).max(60),
  description: z.string().max(2000).optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────
// NOTE: static segments (/unread-count) declared before dynamic params (:conversationId)

router.get('/conversations/unread-count',                       getUnreadCount);
router.get('/conversations/:conversationId/messages',           getConversationMessages);
router.post('/conversations/:conversationId/messages', validate(sendMessageSchema), sendConversationMessage);
router.put('/messages/:messageId',           validate(editMessageSchema),   editConversationMessage);
router.delete('/messages/:messageId',                                       deleteConversationMessage);
router.post('/messages/:messageId/report',   validate(reportMessageSchema), reportConversationMessage);
router.get('/conversations/:conversationId',                    getConversation);
router.get('/conversations',                                    listConversations);
router.post('/conversations', validate(createConversationSchema), createConversation);

export default router;
