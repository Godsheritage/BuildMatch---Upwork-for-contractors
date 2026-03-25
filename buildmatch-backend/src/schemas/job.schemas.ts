import { z } from 'zod';

const TRADE_TYPES = ['plumbing', 'electrical', 'carpentry', 'painting', 'hvac', 'roofing', 'landscaping', 'general'] as const;

export const createJobSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  location: z.string().min(2),
  budget: z.number().positive(),
  tradeType: z.enum(TRADE_TYPES),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
