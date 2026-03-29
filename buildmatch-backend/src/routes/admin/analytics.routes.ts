/**
 * src/routes/admin/analytics.routes.ts
 * Mounted at: /api/admin/analytics
 *
 * Planned endpoints:
 *   GET /api/admin/analytics/signups     — signup trend (daily/weekly/monthly)
 *   GET /api/admin/analytics/jobs        — job posting trend
 *   GET /api/admin/analytics/revenue     — transaction volume + fee revenue
 *   GET /api/admin/analytics/retention   — user retention cohorts
 */

import { Router } from 'express';
import { sendSuccess } from '../../utils/response.utils';

const router = Router();

// Placeholder — remove when real handlers are added
router.get('/', (_req, res) => sendSuccess(res, { status: 'analytics module coming soon' }));

export default router;
