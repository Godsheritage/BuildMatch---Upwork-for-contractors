import { z } from 'zod';
export declare const updateContractorProfileSchema: z.ZodObject<{
    bio: z.ZodOptional<z.ZodString>;
    yearsExperience: z.ZodOptional<z.ZodNumber>;
    specialties: z.ZodOptional<z.ZodArray<z.ZodString>>;
    licenseNumber: z.ZodOptional<z.ZodString>;
    licenseState: z.ZodOptional<z.ZodString>;
    hourlyRateMin: z.ZodOptional<z.ZodNumber>;
    hourlyRateMax: z.ZodOptional<z.ZodNumber>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    zipCode: z.ZodOptional<z.ZodString>;
    isAvailable: z.ZodOptional<z.ZodBoolean>;
    insuranceExpiry: z.ZodOptional<z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<Date, string>>, z.ZodNull]>>;
}, z.core.$strip>;
export type UpdateContractorProfileInput = z.infer<typeof updateContractorProfileSchema>;
//# sourceMappingURL=contractor.schemas.d.ts.map