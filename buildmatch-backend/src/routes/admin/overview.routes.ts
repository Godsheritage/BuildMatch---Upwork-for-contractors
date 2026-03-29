/**
 * src/routes/admin/overview.routes.ts
 *
 * GET /api/admin/overview/stats    — cached 60s aggregation
 * GET /api/admin/overview/activity — last 24h merged activity (max 50)
 * GET /api/admin/overview/alerts   — live business-rule alerts
 *
 * Authentication + ADMIN guard are applied upstream in src/routes/admin/index.ts.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import {
  getOverviewStats,
  getOverviewActivity,
  getOverviewAlerts,
} from '../../services/admin/overview.service';

const router = Router();

// GET /api/admin/overview/stats
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getOverviewStats();
    sendSuccess(res, stats);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/overview] GET /stats error:', err);
    sendError(res, 'Failed to fetch overview stats', 500);
  }
});

// GET /api/admin/overview/activity
router.get('/activity', async (_req: Request, res: Response): Promise<void> => {
  try {
    const activity = await getOverviewActivity();
    sendSuccess(res, { events: activity });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/overview] GET /activity error:', err);
    sendError(res, 'Failed to fetch overview activity', 500);
  }
});

// GET /api/admin/overview/alerts
router.get('/alerts', async (_req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await getOverviewAlerts();
    sendSuccess(res, { alerts });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/overview] GET /alerts error:', err);
    sendError(res, 'Failed to fetch overview alerts', 500);
  }
});

export default router;
