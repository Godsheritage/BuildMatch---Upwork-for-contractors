import type { Response } from 'express';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

export function sendSuccess<T>(res: Response, data: T, message?: string, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data, message };
  return res.status(status).json(body);
}

export function sendError(res: Response, message: string, status = 400, errors?: unknown): Response {
  const body: ApiResponse<null> = { success: false, message, errors };
  return res.status(status).json(body);
}
