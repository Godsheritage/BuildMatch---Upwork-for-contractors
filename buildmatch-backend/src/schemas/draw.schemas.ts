import { z } from 'zod';

// ── AI generation ──────────────────────────────────────────────────────────────

export const generateDrawScheduleSchema = z.object({
  totalAmount: z.number().positive(),
});
export type GenerateDrawScheduleInput = z.infer<typeof generateDrawScheduleSchema>;

// ── Milestone edit (used inside createDrawScheduleSchema and updateMilestone) ──

export const drawMilestoneInputSchema = z.object({
  drawNumber:          z.number().int().positive(),
  title:               z.string().min(3).max(120),
  description:         z.string().min(5).max(500),
  completionCriteria:  z.string().min(5).max(500),
  percentage:          z.number().positive().max(100),
  amount:              z.number().positive(),
  dueDate:             z.string().datetime().optional(),
});
export type DrawMilestoneInput = z.infer<typeof drawMilestoneInputSchema>;

// ── Create schedule (manual or after AI preview) ───────────────────────────────

export const createDrawScheduleSchema = z.object({
  totalAmount: z.number().positive(),
  aiGenerated: z.boolean().default(false),
  milestones:  z.array(drawMilestoneInputSchema).min(1).max(10),
}).refine(
  (d) => {
    const total = d.milestones.reduce((s, m) => s + m.percentage, 0);
    return Math.abs(total - 100) < 0.01;
  },
  { message: 'Milestone percentages must sum to 100', path: ['milestones'] },
);
export type CreateDrawScheduleInput = z.infer<typeof createDrawScheduleSchema>;

// ── Update a single milestone (negotiation) ────────────────────────────────────

export const updateMilestoneSchema = z.object({
  title:              z.string().min(3).max(120).optional(),
  description:        z.string().min(5).max(500).optional(),
  completionCriteria: z.string().min(5).max(500).optional(),
  percentage:         z.number().positive().max(100).optional(),
  amount:             z.number().positive().optional(),
  dueDate:            z.string().datetime().optional().nullable(),
});
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

// ── Approve schedule ───────────────────────────────────────────────────────────
// Body is empty; role determines investor vs contractor approval.
export const approveScheduleSchema = z.object({});

// ── Submit draw request ────────────────────────────────────────────────────────

export const submitDrawRequestSchema = z.object({
  note: z.string().max(1000).optional(),
});
export type SubmitDrawRequestInput = z.infer<typeof submitDrawRequestSchema>;

// ── Review draw request (investor) ────────────────────────────────────────────

export const reviewDrawRequestSchema = z.object({
  action:          z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().min(5).max(500).optional(),
}).refine(
  (d) => d.action === 'APPROVE' || (d.action === 'REJECT' && !!d.rejectionReason),
  { message: 'rejectionReason is required when action is REJECT', path: ['rejectionReason'] },
);
export type ReviewDrawRequestInput = z.infer<typeof reviewDrawRequestSchema>;

// ── Add evidence ───────────────────────────────────────────────────────────────

export const addEvidenceSchema = z.object({
  url:     z.string().url(),
  caption: z.string().max(300).optional(),
});
export type AddEvidenceInput = z.infer<typeof addEvidenceSchema>;
