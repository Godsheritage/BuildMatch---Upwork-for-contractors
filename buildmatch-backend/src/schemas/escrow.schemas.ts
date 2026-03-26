import { z } from 'zod';

export const milestoneInputSchema = z.object({
  title:       z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  percentage:  z.number().positive().max(100),
});

export const fundJobSchema = z.object({
  milestones: z.array(milestoneInputSchema).max(10),
});

export const submitMilestoneSchema = z.object({
  completionNotes: z.string().max(1000).optional(),
});

export const disputeMilestoneSchema = z.object({
  reason: z.string().min(20).max(1000),
});

export const resolveDisputeSchema = z.object({
  resolution: z.enum(['RELEASE', 'REFUND']),
  notes:      z.string().min(1).max(1000),
});

export type MilestoneInput    = z.infer<typeof milestoneInputSchema>;
export type FundJobBody       = z.infer<typeof fundJobSchema>;
export type ResolveDisputeBody = z.infer<typeof resolveDisputeSchema>;
