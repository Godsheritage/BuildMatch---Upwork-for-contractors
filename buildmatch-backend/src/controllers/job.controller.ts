import type { Request, Response } from 'express';
import * as jobService from '../services/job.service';
import { AppError } from '../utils/app-error';
import { sendSuccess, sendError } from '../utils/response.utils';

function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
  } else {
    sendError(res, 'Something went wrong', 500);
  }
}

// ── Job handlers ─────────────────────────────────────────────────────────────

export async function listJobs(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, tradeType, state, city, minBudget, maxBudget, status, search } = req.query;
    const result = await jobService.listJobs({
      page:      page      ? parseInt(page      as string, 10)    : undefined,
      limit:     limit     ? parseInt(limit     as string, 10)    : undefined,
      minBudget: minBudget ? parseFloat(minBudget as string)      : undefined,
      maxBudget: maxBudget ? parseFloat(maxBudget as string)      : undefined,
      tradeType: tradeType as string | undefined,
      state:     state     as string | undefined,
      city:      city      as string | undefined,
      status:    status    as string | undefined,
      search:    search    as string | undefined,
    });
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getJobById(req: Request, res: Response): Promise<void> {
  try {
    const job = await jobService.getJobById(req.params.id, req.user?.userId);
    sendSuccess(res, job);
  } catch (err) {
    handleError(res, err);
  }
}

export async function createJob(req: Request, res: Response): Promise<void> {
  try {
    const job = await jobService.createJob(req.user!.userId, req.body);
    sendSuccess(res, job, 'Job created', 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function updateJob(req: Request, res: Response): Promise<void> {
  try {
    const job = await jobService.updateJob(req.params.id, req.user!.userId, req.body);
    sendSuccess(res, job);
  } catch (err) {
    handleError(res, err);
  }
}

export async function cancelJob(req: Request, res: Response): Promise<void> {
  try {
    const job = await jobService.cancelJob(req.params.id, req.user!.userId);
    sendSuccess(res, job, 'Job cancelled');
  } catch (err) {
    handleError(res, err);
  }
}

export async function getMyJobs(req: Request, res: Response): Promise<void> {
  try {
    const jobs = await jobService.getMyJobs(req.user!.userId);
    sendSuccess(res, jobs);
  } catch (err) {
    handleError(res, err);
  }
}

// ── Bid handlers ─────────────────────────────────────────────────────────────

export async function createBid(req: Request, res: Response): Promise<void> {
  try {
    const bid = await jobService.createBid(req.params.jobId, req.user!.userId, req.body);
    sendSuccess(res, bid, 'Bid submitted', 201);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getJobBids(req: Request, res: Response): Promise<void> {
  try {
    const bids = await jobService.getJobBids(req.params.jobId, req.user!.userId, req.user!.role);
    sendSuccess(res, bids);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getMyBid(req: Request, res: Response): Promise<void> {
  try {
    const bid = await jobService.getMyBid(req.params.jobId, req.user!.userId);
    sendSuccess(res, bid);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getMyBids(req: Request, res: Response): Promise<void> {
  try {
    const bids = await jobService.getMyBids(req.user!.userId);
    sendSuccess(res, bids);
  } catch (err) {
    handleError(res, err);
  }
}

export async function acceptBid(req: Request, res: Response): Promise<void> {
  try {
    const bid = await jobService.acceptBid(req.params.jobId, req.params.bidId, req.user!.userId);
    sendSuccess(res, bid, 'Bid accepted');
  } catch (err) {
    handleError(res, err);
  }
}

export async function withdrawBid(req: Request, res: Response): Promise<void> {
  try {
    const bid = await jobService.withdrawBid(req.params.jobId, req.params.bidId, req.user!.userId);
    sendSuccess(res, bid, 'Bid withdrawn');
  } catch (err) {
    handleError(res, err);
  }
}
