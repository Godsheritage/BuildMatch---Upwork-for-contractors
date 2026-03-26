import { z } from 'zod';
export declare const milestoneInputSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    percentage: z.ZodNumber;
}, z.core.$strip>;
export declare const fundJobSchema: z.ZodObject<{
    milestones: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        percentage: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const submitMilestoneSchema: z.ZodObject<{
    completionNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const disputeMilestoneSchema: z.ZodObject<{
    reason: z.ZodString;
}, z.core.$strip>;
export declare const resolveDisputeSchema: z.ZodObject<{
    resolution: z.ZodEnum<{
        RELEASE: "RELEASE";
        REFUND: "REFUND";
    }>;
    notes: z.ZodString;
}, z.core.$strip>;
export type MilestoneInput = z.infer<typeof milestoneInputSchema>;
export type FundJobBody = z.infer<typeof fundJobSchema>;
export type ResolveDisputeBody = z.infer<typeof resolveDisputeSchema>;
//# sourceMappingURL=escrow.schemas.d.ts.map