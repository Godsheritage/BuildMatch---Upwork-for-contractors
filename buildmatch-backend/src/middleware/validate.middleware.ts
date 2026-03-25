import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { sendError } from '../utils/response.utils';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      sendError(res, 'Validation failed', 422, result.error.flatten().fieldErrors);
      return;
    }
    req.body = result.data;
    next();
  };
}
