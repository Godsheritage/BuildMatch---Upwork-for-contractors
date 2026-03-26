import type { Request, Response } from 'express';
import * as messageService from '../services/message.service';
import { AppError } from '../utils/app-error';
import { sendSuccess, sendError } from '../utils/response.utils';

function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
  } else {
    sendError(res, 'Something went wrong', 500);
  }
}

export async function createMessage(req: Request, res: Response): Promise<void> {
  try {
    const msg = await messageService.createMessage(
      req.params.jobId,
      req.user!.userId,
      req.body.body,
    );
    sendSuccess(res, msg, 'Message sent', 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getJobMessages(req: Request, res: Response): Promise<void> {
  try {
    const messages = await messageService.getJobMessages(req.params.jobId, req.user!.userId);
    sendSuccess(res, messages);
  } catch (err) {
    handleError(res, err);
  }
}
