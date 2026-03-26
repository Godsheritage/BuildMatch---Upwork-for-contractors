import { z } from 'zod';
export declare const createJobSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    tradeType: z.ZodEnum<{
        GENERAL: "GENERAL";
        ELECTRICAL: "ELECTRICAL";
        PLUMBING: "PLUMBING";
        HVAC: "HVAC";
        ROOFING: "ROOFING";
        FLOORING: "FLOORING";
        PAINTING: "PAINTING";
        LANDSCAPING: "LANDSCAPING";
        DEMOLITION: "DEMOLITION";
        OTHER: "OTHER";
    }>;
    budgetMin: z.ZodNumber;
    budgetMax: z.ZodNumber;
    city: z.ZodString;
    state: z.ZodString;
    zipCode: z.ZodString;
}, z.core.$strip>;
export declare const updateJobSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    tradeType: z.ZodOptional<z.ZodEnum<{
        GENERAL: "GENERAL";
        ELECTRICAL: "ELECTRICAL";
        PLUMBING: "PLUMBING";
        HVAC: "HVAC";
        ROOFING: "ROOFING";
        FLOORING: "FLOORING";
        PAINTING: "PAINTING";
        LANDSCAPING: "LANDSCAPING";
        DEMOLITION: "DEMOLITION";
        OTHER: "OTHER";
    }>>;
    budgetMin: z.ZodOptional<z.ZodNumber>;
    budgetMax: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const createBidSchema: z.ZodObject<{
    amount: z.ZodNumber;
    message: z.ZodString;
}, z.core.$strip>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type CreateBidInput = z.infer<typeof createBidSchema>;
//# sourceMappingURL=job.schemas.d.ts.map