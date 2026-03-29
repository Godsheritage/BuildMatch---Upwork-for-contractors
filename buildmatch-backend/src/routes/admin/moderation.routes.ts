/**
 * src/routes/admin/moderation.routes.ts
 * Mounted at: /api/admin/moderation
 *
 * Planned endpoints:
 *   GET    /api/admin/moderation/messages          — flagged messages queue
 *   DELETE /api/admin/moderation/messages/:id      — remove a message
 *   GET    /api/admin/moderation/filter-patterns   — current filter patterns
 *   POST   /api/admin/moderation/filter-patterns   — add a filter pattern
 *   DELETE /api/admin/moderation/filter-patterns/:id — remove a pattern
 */

import { Router } from 'express';
import { sendSuccess } from '../../utils/response.utils';

const router = Router();

// Placeholder — remove when real handlers are added
router.get('/', (_req, res) => sendSuccess(res, { status: 'moderation module coming soon' }));

export default router;
