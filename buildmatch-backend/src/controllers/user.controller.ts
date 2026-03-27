import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';
import { setAvatarUrl, clearAvatarUrl, updateUserProfile } from '../services/user.service';
import type { UpdateProfileInput } from '../schemas/user.schemas';

// Matches https://<project-ref>.supabase.co/storage/v1/object/public/avatars/
const SUPABASE_AVATAR_PREFIX = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/avatars\//;

export async function updateAvatar(req: Request, res: Response): Promise<void> {
  const { avatarUrl } = req.body as { avatarUrl: string };

  if (!SUPABASE_AVATAR_PREFIX.test(avatarUrl)) {
    sendError(res, 'Invalid avatar URL — must be a Supabase Storage URL', 400);
    return;
  }

  try {
    const user = await setAvatarUrl(req.user!.userId, avatarUrl);
    sendSuccess(res, user);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Failed to update avatar', 500);
  }
}

export async function deleteAvatar(req: Request, res: Response): Promise<void> {
  try {
    const user = await clearAvatarUrl(req.user!.userId);
    sendSuccess(res, user);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Failed to remove avatar', 500);
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const input = req.body as UpdateProfileInput;
    const user = await updateUserProfile(req.user!.userId, input);
    sendSuccess(res, user, 'Profile updated');
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Failed to update profile', 500);
  }
}
