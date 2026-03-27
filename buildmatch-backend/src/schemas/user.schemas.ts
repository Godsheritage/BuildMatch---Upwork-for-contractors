import { z } from 'zod';

export const updateAvatarSchema = z.object({
  avatarUrl: z.string().min(1, 'avatarUrl is required'),
});

export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName:  z.string().min(2).max(100).optional(),
  phone:     z.string().max(30).nullable().optional(),
  bio:       z.string().max(2000).nullable().optional(),
  city:      z.string().max(100).nullable().optional(),
  state:     z.string().max(100).nullable().optional(),
  company:   z.string().max(150).nullable().optional(),
  title:     z.string().max(150).nullable().optional(),
  website:   z.string().url('Must be a valid URL').nullable().optional().or(z.literal('')),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
