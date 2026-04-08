import { z } from 'zod';

export const updateAvatarSchema = z.object({
  avatarUrl: z.string().min(1, 'avatarUrl is required'),
});

export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const updateProfileSchema = z.object({
  firstName:    z.string().min(2).max(100).optional(),
  lastName:     z.string().min(2).max(100).optional(),
  phone:        z.string().max(30).nullable().optional(),
  bio:          z.string().max(2000).nullable().optional(),
  city:         z.string().max(100).nullable().optional(),
  state:        z.string().max(100).nullable().optional(),
  company:      z.string().max(150).nullable().optional(),
  title:        z.string().max(150).nullable().optional(),
  website:      z.string().url('Must be a valid URL').nullable().optional().or(z.literal('')),
  displayName:  z.string().max(80).nullable().optional(),
  pronouns:     z.string().max(40).nullable().optional(),
  timezone:     z.string().max(60).nullable().optional(),
  locale:       z.string().max(15).nullable().optional(),
  dateFormat:   z.enum(['MDY', 'DMY', 'YMD', 'LONG']).nullable().optional(),
  numberFormat: z.enum(['EN', 'EU']).nullable().optional(),
  quietHoursStart: z.string().regex(HHMM, 'Use HH:MM').nullable().optional(),
  quietHoursEnd:   z.string().regex(HHMM, 'Use HH:MM').nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
