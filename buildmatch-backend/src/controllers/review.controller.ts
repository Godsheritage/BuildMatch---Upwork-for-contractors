import type { Request, Response } from 'express';
import * as reviewService from '../services/review.service';
import { AppError } from '../utils/app-error';
import { sendSuccess, sendError } from '../utils/response.utils';

function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
  } else {
    sendError(res, 'Something went wrong', 500);
  }
}

export async function completeJob(req: Request, res: Response): Promise<void> {
  try {
    const job = await reviewService.completeJob(req.params.jobId, req.user!.userId);
    sendSuccess(res, job, 'Job marked as complete');
  } catch (err) {
    handleError(res, err);
  }
}

export async function createReview(req: Request, res: Response): Promise<void> {
  try {
    const review = await reviewService.createReview(
      req.params.jobId,
      req.user!.userId,
      req.user!.role as 'INVESTOR' | 'CONTRACTOR' | 'ADMIN',
      req.body,
    );
    sendSuccess(res, review, 'Review submitted', 201);
  } catch (err) {
    // Unique constraint → already reviewed
    if ((err as { code?: string }).code === 'P2002') {
      sendError(res, 'You have already reviewed this job', 409);
      return;
    }
    handleError(res, err);
  }
}

export async function listContractorReviews(req: Request, res: Response): Promise<void> {
  try {
    const { page = 1, limit = 10, sort = 'newest' } = req.query;
    const result = await reviewService.listContractorReviews(
      req.params.contractorId,
      Number(page),
      Number(limit),
      sort as 'newest' | 'highest' | 'lowest',
    );
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

export async function listJobReviews(req: Request, res: Response): Promise<void> {
  try {
    const reviews = await reviewService.listJobReviews(
      req.params.jobId,
      req.user!.userId,
      req.user!.role,
    );
    sendSuccess(res, reviews);
  } catch (err) {
    handleError(res, err);
  }
}
