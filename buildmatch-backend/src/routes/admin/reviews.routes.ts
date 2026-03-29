/**
 * src/routes/admin/reviews.routes.ts
 * Mounted at: /api/admin/reviews
 *
 * Planned endpoints:
 *   GET  /api/admin/reviews                    — paginated reviews list
 *   PUT  /api/admin/reviews/:id/approve        — approve a pending review
 *   DELETE /api/admin/reviews/:id              — remove a review
 *   PUT  /api/admin/reviews/:id                — edit review content
 */

import { Router } from 'express';
import { sendSuccess } from '../../utils/response.utils';

const router = Router();

// Placeholder — remove when real handlers are added
router.get('/', (_req, res) => sendSuccess(res, { status: 'reviews module coming soon' }));

export default router;
