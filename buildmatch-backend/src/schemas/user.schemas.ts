import { z } from 'zod';

export const updateAvatarSchema = z.object({
  avatarUrl: z.string().min(1, 'avatarUrl is required'),
});

export type UpdateAvatarInput = z.infer<typeof updateAvatarSchema>;
