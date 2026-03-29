/**
 * src/routes/admin/index.ts
 *
 * Central admin router. Applies authentication + ADMIN guard ONCE for all
 * /api/admin/* routes. Sub-routers must NOT re-apply these middleware layers.
 *
 * Mounted in app.ts at: /api/admin
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';

// ── Sub-routers ───────────────────────────────────────────────────────────────

import adminStatsRouter        from './stats.routes';
import adminUsersRouter        from './users.routes';
import adminContractorsRouter  from './contractors.routes';
import adminJobsRouter         from './jobs.routes';
import adminDisputesRouter     from './disputes.routes';
import adminAuditRouter        from './audit.routes';
import adminSettingsRouter     from './settings.routes';
import adminFeatureFlagsRouter from './feature-flags.routes';
import adminBannedEmailsRouter from './banned-emails.routes';
import adminFinanceRouter      from './finance.routes';
import adminModerationRouter   from './moderation.routes';
import adminReviewsRouter      from './reviews.routes';
import adminAnalyticsRouter    from './analytics.routes';
import adminHealthRouter       from './health.routes';

// ── Router ────────────────────────────────────────────────────────────────────

const adminRouter = Router();

// Two-layer guard applied once — sub-routers inherit this protection.
adminRouter.use(authenticate);
adminRouter.use(requireAdmin);

// ── Mount sub-routers ─────────────────────────────────────────────────────────
// Static path segments before any dynamic :param routes at the same level.

adminRouter.use('/stats',         adminStatsRouter);
adminRouter.use('/users',         adminUsersRouter);
adminRouter.use('/contractors',   adminContractorsRouter);
adminRouter.use('/jobs',          adminJobsRouter);
adminRouter.use('/disputes',      adminDisputesRouter);
adminRouter.use('/audit',         adminAuditRouter);
adminRouter.use('/settings',      adminSettingsRouter);
adminRouter.use('/flags',         adminFeatureFlagsRouter);
adminRouter.use('/banned-emails', adminBannedEmailsRouter);
adminRouter.use('/finance',       adminFinanceRouter);
adminRouter.use('/moderation',    adminModerationRouter);
adminRouter.use('/reviews',       adminReviewsRouter);
adminRouter.use('/analytics',     adminAnalyticsRouter);
adminRouter.use('/health',        adminHealthRouter);

export default adminRouter;
