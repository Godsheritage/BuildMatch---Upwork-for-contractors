import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response.utils';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.register(req.body);
    sendSuccess(res, result, 'Account created', 201);
  } catch (err) {
    sendError(res, (err as Error).message, 400);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    sendError(res, (err as Error).message, 401);
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.userId);
    sendSuccess(res, user);
  } catch (err) {
    sendError(res, (err as Error).message, 404);
  }
}
