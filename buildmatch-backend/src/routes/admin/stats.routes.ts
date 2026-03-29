import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { getPlatformStats, getRecentActivity } from '../../services/admin/stats.service';

const router = Router();

// GET /api/admin/stats
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getPlatformStats();
    sendSuccess(res, stats);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/stats] GET / error:', err);
    sendError(res, 'Failed to fetch platform stats', 500);
  }
});

// GET /api/admin/stats/activity
router.get('/activity', async (_req: Request, res: Response): Promise<void> => {
  try {
    const activity = await getRecentActivity(20);
    sendSuccess(res, activity);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/stats] GET /activity error:', err);
    sendError(res, 'Failed to fetch recent activity', 500);
  }
});

export default router;
