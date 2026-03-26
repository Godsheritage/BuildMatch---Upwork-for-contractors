import { z } from 'zod';

const TRADE_TYPES = [
  'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING',
  'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
] as const;

export const createJobSchema = z.object({
  title:       z.string().min(10,  'Title must be at least 10 characters').max(120, 'Title must be at most 120 characters'),
  description: z.string().min(50,  'Description must be at least 50 characters').max(2000),
  tradeType:   z.enum(TRADE_TYPES),
  budgetMin:   z.number().positive('budgetMin must be positive'),
  budgetMax:   z.number().positive('budgetMax must be positive'),
  city:        z.string().min(1, 'City is required'),
  state:       z.string().min(1, 'State is required'),
  zipCode:     z.string().min(1, 'Zip code is required'),
  photos:      z.array(z.string().min(1)).max(10).optional(),
}).refine((d) => d.budgetMin < d.budgetMax, {
  message: 'budgetMin must be less than budgetMax',
  path: ['budgetMin'],
});

export const updateJobSchema = z.object({
  title:       z.string().min(10).max(120).optional(),
  description: z.string().min(50).max(2000).optional(),
  tradeType:   z.enum(TRADE_TYPES).optional(),
  budgetMin:   z.number().positive().optional(),
  budgetMax:   z.number().positive().optional(),
}).refine(
  (d) => !(d.budgetMin !== undefined && d.budgetMax !== undefined) || d.budgetMin < d.budgetMax,
  { message: 'budgetMin must be less than budgetMax', path: ['budgetMin'] },
);

export const createBidSchema = z.object({
  amount:  z.number().positive('Amount must be positive'),
  message: z.string().min(20, 'Message must be at least 20 characters').max(500, 'Message must be at most 500 characters'),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type CreateBidInput = z.infer<typeof createBidSchema>;
