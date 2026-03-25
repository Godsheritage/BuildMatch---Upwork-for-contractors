import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';
import { sendError } from '../utils/response.utils';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'Missing or invalid authorization header', 401);
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    sendError(res, 'Invalid or expired token', 401);
  }
}
