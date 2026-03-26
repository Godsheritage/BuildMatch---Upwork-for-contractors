import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title:  z.string().min(5).max(100),
  body:   z.string().min(20).max(1000),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const listContractorReviewsSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort:  z.enum(['newest', 'highest', 'lowest']).default('newest'),
});
