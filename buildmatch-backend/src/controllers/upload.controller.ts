import type { Request, Response } from 'express';
import { getServiceClient } from '../lib/supabase';
import { sendSuccess, sendError } from '../utils/response.utils';

const ALLOWED_BUCKETS = new Set(['job-photos', 'job-videos', 'avatars', 'dispute-evidence', 'draw-evidence']);

export async function createPresignedUploadUrl(req: Request, res: Response): Promise<void> {
  const { bucket, path } = req.body as { bucket: string; path: string };
  const userId = req.user!.userId;

  if (!bucket || !ALLOWED_BUCKETS.has(bucket)) {
    sendError(res, 'Invalid bucket', 400);
    return;
  }
  if (!path || !path.startsWith(`${userId}/`)) {
    sendError(res, 'Path must start with your user ID', 403);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);

    if (error || !data) {
      sendError(res, 'Failed to generate upload URL', 500);
      return;
    }

    sendSuccess(res, { signedUrl: data.signedUrl, token: data.token, path: data.path });
  } catch {
    sendError(res, 'Failed to generate upload URL', 500);
  }
}

export async function deleteStorageObject(req: Request, res: Response): Promise<void> {
  const { bucket, path } = req.body as { bucket: string; path: string };
  const userId = req.user!.userId;

  if (!bucket || !ALLOWED_BUCKETS.has(bucket)) {
    sendError(res, 'Invalid bucket', 400);
    return;
  }
  if (!path || !path.startsWith(`${userId}/`)) {
    sendError(res, 'Path must start with your user ID', 403);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      sendError(res, 'Failed to delete file', 500);
      return;
    }

    sendSuccess(res, null, 'File deleted');
  } catch {
    sendError(res, 'Failed to delete file', 500);
  }
}
