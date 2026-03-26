import { z } from 'zod';

export const updateContractorProfileSchema = z
  .object({
    bio: z.string().max(2000).optional(),
    yearsExperience: z.number().int().min(0).max(60).optional(),
    specialties: z.array(z.string().min(1).max(100)).max(20).optional(),
    licenseNumber: z.string().max(100).optional(),
    licenseState: z.string().length(2).toUpperCase().optional(),
    hourlyRateMin: z.number().min(0).optional(),
    hourlyRateMax: z.number().min(0).optional(),
    city: z.string().max(100).optional(),
    state: z.string().length(2).toUpperCase().optional(),
    zipCode: z.string().max(10).optional(),
    isAvailable: z.boolean().optional(),
    avatarUrl: z.string().min(1).optional(),
    // ISO-8601 string → coerced to Date; null clears the stored value
    insuranceExpiry: z
      .union([
        z.string().datetime({ offset: true }).transform((v) => new Date(v)),
        z.null(),
      ])
      .optional(),
  })
  .refine(
    (data) => {
      if (data.hourlyRateMin !== undefined && data.hourlyRateMax !== undefined) {
        return data.hourlyRateMin <= data.hourlyRateMax;
      }
      return true;
    },
    { message: 'hourlyRateMin must be ≤ hourlyRateMax', path: ['hourlyRateMin'] },
  );

export type UpdateContractorProfileInput = z.infer<typeof updateContractorProfileSchema>;
