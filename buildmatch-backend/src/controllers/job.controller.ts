import type { Request, Response } from 'express';
import * as jobService from '../services/job.service';
import { sendSuccess, sendError } from '../utils/response.utils';

export async function getAll(_req: Request, res: Response): Promise<void> {
  try {
    const jobs = await jobService.getAllJobs();
    sendSuccess(res, jobs);
  } catch (err) {
    sendError(res, (err as Error).message, 500);
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const job = await jobService.getJobById(req.params.id);
    sendSuccess(res, job);
  } catch (err) {
    sendError(res, (err as Error).message, 404);
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const job = await jobService.createJob(req.user!.userId, req.body);
    sendSuccess(res, job, 'Job created', 201);
  } catch (err) {
    sendError(res, (err as Error).message, 400);
  }
}
