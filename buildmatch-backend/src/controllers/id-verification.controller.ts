import type { Request, Response } from 'express';
import * as svc from '../services/id-verification.service';
import { AppError } from '../utils/app-error';
import { sendSuccess, sendError } from '../utils/response.utils';

function handle(res: Response, err: unknown): void {
  if (err instanceof AppError) sendError(res, err.message, err.statusCode);
  else { console.error('[id-verification]', err); sendError(res, 'Something went wrong', 500); }
}

export async function createSession(req: Request, res: Response): Promise<void> {
  try {
    const result = await svc.createSession(req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handle(res, err); }
}

export async function getStatus(req: Request, res: Response): Promise<void> {
  try {
    const result = await svc.getSessionStatus(req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { handle(res, err); }
}

export async function getMobileSession(req: Request, res: Response): Promise<void> {
  try {
    const ua = req.headers['user-agent'];
    if (!svc.isMobilePhoneUA(ua)) {
      sendError(res, 'Open this link on your phone to continue.', 403);
      return;
    }
    const result = await svc.getMobileSession(req.params.token!);
    sendSuccess(res, result);
  } catch (err) { handle(res, err); }
}

export async function presignMobile(req: Request, res: Response): Promise<void> {
  try {
    const { kind, ext } = req.body ?? {};
    if (kind !== 'document' && kind !== 'selfie') { sendError(res, 'Invalid kind', 400); return; }
    const result = await svc.presignMobileUpload(req.params.token!, kind, typeof ext === 'string' ? ext : 'jpg');
    sendSuccess(res, result);
  } catch (err) { handle(res, err); }
}

export async function completeMobile(req: Request, res: Response): Promise<void> {
  try {
    const { documentUrl, selfieUrl, country, idType } = req.body ?? {};
    await svc.completeMobileSession(req.params.token!, { documentUrl, selfieUrl, country, idType });
    sendSuccess(res, null, 'Submitted for review');
  } catch (err) { handle(res, err); }
}
