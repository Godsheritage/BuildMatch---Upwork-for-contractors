import { z } from 'zod';

export const waitlistSchema = z.object({
  name:  z.string().min(1).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  role:  z.enum(['INVESTOR', 'CONTRACTOR']).optional(),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
