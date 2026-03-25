import { z } from 'zod';

const TRADE_TYPES = [
  'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING',
  'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
] as const;

export const createJobSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  tradeType: z.enum(TRADE_TYPES),
  budgetMin: z.number().positive(),
  budgetMax: z.number().positive(),
  city: z.string().min(2),
  state: z.string().min(2),
  zipCode: z.string().min(3),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
