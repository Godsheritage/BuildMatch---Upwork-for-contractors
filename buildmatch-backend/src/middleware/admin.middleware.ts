import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.utils';

/**
 * requireAdmin — second guard in every admin middleware chain.
 * Must follow `authenticate`, which populates req.user.
 * Returns 403 if the authenticated user's role is not ADMIN.
 *
 * Usage in every admin router:
 *   router.use(authenticate, requireAdmin);
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    sendError(res, 'Forbidden: admin access required', 403);
    return;
  }
  next();
}
