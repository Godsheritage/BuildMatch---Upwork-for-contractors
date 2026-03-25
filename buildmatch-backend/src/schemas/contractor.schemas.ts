import { z } from 'zod';

export const contractorProfileSchema = z.object({
  bio: z.string().min(10).max(1000),
  specialty: z.array(z.string()).min(1),
  hourlyRateMin: z.number().positive(),
  hourlyRateMax: z.number().positive(),
  yearsExperience: z.number().int().nonnegative(),
  location: z.string().min(2),
});

export type ContractorProfileInput = z.infer<typeof contractorProfileSchema>;
