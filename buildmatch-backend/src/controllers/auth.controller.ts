import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { AppError } from '../utils/app-error';
import { sendSuccess, sendError } from '../utils/response.utils';

function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
  } else {
    console.error('[auth controller]', err);
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

export async function googleAuth(req: Request, res: Response): Promise<void> {
  try {
    const { idToken, role, firstName, lastName, phone } = req.body ?? {};
    if (!idToken || typeof idToken !== 'string') {
      sendError(res, 'idToken is required', 400);
      return;
    }
    const result = await authService.loginOrRegisterWithGoogle({
      idToken,
      role:      role === 'INVESTOR' || role === 'CONTRACTOR' ? role : undefined,
      firstName: typeof firstName === 'string' ? firstName : undefined,
      lastName:  typeof lastName  === 'string' ? lastName  : undefined,
      phone:     typeof phone     === 'string' ? phone     : undefined,
    });
    sendSuccess(res, result, result.isNewUser ? 'Account created' : 'Login successful');
  } catch (err) {
    handleError(res, err);
  }
}

export async function linkGoogle(req: Request, res: Response): Promise<void> {
  try {
    const { idToken } = req.body ?? {};
    if (!idToken || typeof idToken !== 'string') {
      sendError(res, 'idToken is required', 400);
      return;
    }
    const user = await authService.linkGoogleToCurrentUser(req.user!.userId, idToken);
    sendSuccess(res, user, 'Google account linked');
  } catch (err) {
    handleError(res, err);
  }
}

export async function unlinkGoogle(req: Request, res: Response): Promise<void> {
  try {
    const user = await authService.unlinkGoogleFromCurrentUser(req.user!.userId);
    sendSuccess(res, user, 'Google account unlinked');
  } catch (err) {
    handleError(res, err);
  }
}
