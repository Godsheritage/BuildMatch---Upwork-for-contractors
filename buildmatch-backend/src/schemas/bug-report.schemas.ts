import { z } from 'zod';

export const submitBugReportSchema = z.object({
  title:          z.string().trim().min(5).max(140),
  description:    z.string().trim().min(10).max(4000),
  severity:       z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  pageUrl:        z.string().max(500).optional(),
  userAgent:      z.string().max(500).optional(),
  screenshotUrls: z.array(z.string().url()).max(3).default([]),
});
export type SubmitBugReportInput = z.infer<typeof submitBugReportSchema>;

export const updateBugReportSchema = z.object({
  status:    z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX']).optional(),
  adminNote: z.string().max(4000).nullable().optional(),
});
export type UpdateBugReportInput = z.infer<typeof updateBugReportSchema>;
