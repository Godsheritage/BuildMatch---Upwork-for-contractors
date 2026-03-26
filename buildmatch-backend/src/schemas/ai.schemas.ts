import { z } from 'zod';

export const polishReplySchema = z.object({
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  context: z.enum(['investor', 'contractor']),
});

export const createMessageSchema = z.object({
  body: z.string().min(1, 'Message body is required').max(2000),
});

export type PolishReplyInput   = z.infer<typeof polishReplySchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
