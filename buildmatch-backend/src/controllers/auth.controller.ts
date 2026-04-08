import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import * as passwordResetService from '../services/password-reset.service';
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

// ── Password reset ───────────────────────────────────────────────────────────

const GENERIC_RESET_REPLY =
  "If an account exists for that email, we've sent a reset link. Check your inbox.";

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body ?? {};
    // Always succeed — never reveal whether an account exists.
    if (typeof email === 'string') {
      await passwordResetService.requestPasswordReset(email);
    }
    sendSuccess(res, null, GENERIC_RESET_REPLY);
  } catch (err) {
    // Even on internal failure, don't leak — log and return the generic reply.
    console.error('[auth] forgotPassword error:', err);
    sendSuccess(res, null, GENERIC_RESET_REPLY);
  }
}

export async function verifyResetToken(req: Request, res: Response): Promise<void> {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const result = await passwordResetService.verifyResetToken(token);
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, password } = req.body ?? {};
    if (typeof token !== 'string' || typeof password !== 'string') {
      sendError(res, 'Invalid request', 400);
      return;
    }
    await passwordResetService.consumeResetToken(token, password);
    sendSuccess(res, null, 'Password updated. You can now sign in.');
  } catch (err) {
    handleError(res, err);
  }
}
