import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { getServiceClient } from '../lib/supabase';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message    = err instanceof AppError
    ? err.message
    : (process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message);

  if (statusCode < 500) {
    res.status(statusCode).json({ success: false, message });
    return;
  }

  console.error(err.stack);

  // Fire-and-forget: log every 5xx to api_error_log so the admin health
  // dashboard can surface error patterns.  Never blocks the response.
  getServiceClient()
    .from('api_error_log')
    .insert({
      endpoint:    req.path,
      method:      req.method,
      status_code: statusCode,
      error_msg:   err.message ?? null,
      user_id:     req.user?.userId ?? null,
    })
    .then(
      () => { /* ok */ },
      (logErr: unknown) => { console.error('[errorHandler] api_error_log insert failed:', logErr); },
    );

  res.status(statusCode).json({ success: false, message });
}
