import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { AppError } from '../utils/app-error';
import { sendSuccess, sendError } from '../utils/response.utils';

function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
  } else {
    sendError(res, 'Something went wrong', 500);
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.register(req.body);
    sendSuccess(res, result, 'Account created successfully', 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    handleError(res, err);
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.userId);
    sendSuccess(res, user);
  } catch (err) {
    handleError(res, err);
  }
}
