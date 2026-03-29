/**
 * src/routes/admin/finance.routes.ts
 * Mounted at: /api/admin/finance
 *
 * Planned endpoints:
 *   POST /api/admin/finance/payments/:paymentId/retry   — retry a failed payment
 *   POST /api/admin/finance/payments/:paymentId/refund  — issue a refund
 *   GET  /api/admin/finance/escrow                      — escrow balance overview
 */

import { Router } from 'express';
import { sendSuccess } from '../../utils/response.utils';

const router = Router();

// Placeholder — remove when real handlers are added
router.get('/', (_req, res) => sendSuccess(res, { status: 'finance module coming soon' }));

export default router;
