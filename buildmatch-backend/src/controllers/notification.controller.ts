import type { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import { sendSuccess, sendError } from '../utils/response.utils';

export async function getNotifications(req: Request, res: Response): Promise<void> {
  try {
    const notifications = await notificationService.getNotificationsForUser(
      req.user!.userId,
      req.user!.role,
    );
    sendSuccess(res, { notifications });
  } catch (err) {
    console.error('Notification error:', err);
    sendError(res, 'Failed to load notifications', 500);
  }
}
