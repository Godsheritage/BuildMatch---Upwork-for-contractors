import { z } from 'zod';

const TRADE_TYPES = [
  'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING',
  'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
] as const;

// Validates that a URL points to the Supabase job-photos storage bucket
const JOB_PHOTO_SEGMENT = '/storage/v1/object/public/job-photos/';
const jobPhotoUrl = z
  .string()
  .url('Each entry must be a valid URL')
  .refine((u) => u.includes(JOB_PHOTO_SEGMENT), 'URL must be a Supabase job-photos storage URL');

export const createJobSchema = z.object({
  title:       z.string().min(10,  'Title must be at least 10 characters').max(120, 'Title must be at most 120 characters'),
  description: z.string().min(50,  'Description must be at least 50 characters').max(2000),
  tradeType:   z.enum(TRADE_TYPES),
  budgetMin:   z.number().positive('budgetMin must be positive'),
  budgetMax:   z.number().positive('budgetMax must be positive'),
  city:        z.string().min(1, 'City is required'),
  state:       z.string().min(1, 'State is required'),
  zipCode:     z.string().min(1, 'Zip code is required'),
  photoUrls:   z.array(z.string().url()).max(20).optional(),
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
  photoUrls:   z.array(z.string().url()).optional(),
}).refine(
  (d) => !(d.budgetMin !== undefined && d.budgetMax !== undefined) || d.budgetMin < d.budgetMax,
  { message: 'budgetMin must be less than budgetMax', path: ['budgetMin'] },
);

export const addPhotosSchema = z.object({
  photoUrls: z.array(jobPhotoUrl).min(1, 'At least one photo URL is required'),
});

export const removePhotoSchema = z.object({
  photoUrl: jobPhotoUrl,
});

export const createBidSchema = z.object({
  amount:  z.number().positive('Amount must be positive'),
  message: z.string().min(20, 'Message must be at least 20 characters').max(500, 'Message must be at most 500 characters'),
});

export type CreateJobInput   = z.infer<typeof createJobSchema>;
export type UpdateJobInput   = z.infer<typeof updateJobSchema>;
export type AddPhotosInput   = z.infer<typeof addPhotosSchema>;
export type RemovePhotoInput = z.infer<typeof removePhotoSchema>;
export type CreateBidInput   = z.infer<typeof createBidSchema>;
