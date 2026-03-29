import type { Request, Response, NextFunction } from 'express';

/**
 * requireAdmin — second guard in the admin middleware chain.
 * Must follow `authenticate`, which populates req.user.
 * Returns 403 if the authenticated user's role is not ADMIN.
 *
 * Applied once on the parent adminRouter in src/routes/admin/index.ts —
 * individual sub-routers must NOT re-apply it.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }
  next();
}

/**
 * getClientIp — extracts the real client IP, respecting proxy headers.
 * Reads x-forwarded-for first (set by load balancers / reverse proxies),
 * then falls back to req.ip.
 */
export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first?.trim();
  }
  return req.ip;
}
