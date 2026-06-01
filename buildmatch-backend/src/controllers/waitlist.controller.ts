import type { Request, Response } from 'express';
import { addToWaitlist } from '../services/waitlist.service';
import { sendSuccess, sendError } from '../utils/response.utils';

export async function joinWaitlist(req: Request, res: Response): Promise<void> {
  try {
    await addToWaitlist(req.body);
    sendSuccess(res, null, "You're on the list! We'll be in touch on July 1st.", 201);
  } catch (err) {
    console.error('[waitlist] error:', err);
    sendError(res, 'Something went wrong. Please try again.', 500);
  }
}
