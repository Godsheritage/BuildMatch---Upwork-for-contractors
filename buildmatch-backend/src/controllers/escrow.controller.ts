import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import {
  fundJob,
  getEscrow,
  submitMilestone,
  approveMilestone,
  disputeMilestone,
  resolveDispute,
} from '../services/escrow.service';

function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
  } else {
    sendError(res, 'Internal server error', 500);
  }
}

// POST /api/escrow/fund-job/:jobId
export async function fundJobHandler(req: Request, res: Response): Promise<void> {
  try {
    const { jobId }    = req.params;
    const investorId   = req.user!.userId;
    const { milestones } = req.body as { milestones: { title: string; description?: string; percentage: number }[] };

    const result = await fundJob(jobId, investorId, milestones);
    sendSuccess(res, result, 'Escrow created', 201);
  } catch (err) {
    handleError(res, err);
  }
}

// GET /api/escrow/:jobId
export async function getEscrowHandler(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const userId    = req.user!.userId;
    const role      = req.user!.role;

    const escrow = await getEscrow(jobId, userId, role);
    sendSuccess(res, escrow);
  } catch (err) {
    handleError(res, err);
  }
}

// POST /api/escrow/:jobId/milestones/:milestoneId/submit
export async function submitMilestoneHandler(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, milestoneId } = req.params;
    const contractorId           = req.user!.userId;
    const { completionNotes }    = req.body as { completionNotes?: string };

    const milestone = await submitMilestone(jobId, milestoneId, contractorId, completionNotes);
    sendSuccess(res, milestone);
  } catch (err) {
    handleError(res, err);
  }
}

// POST /api/escrow/:jobId/milestones/:milestoneId/approve
export async function approveMilestoneHandler(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, milestoneId } = req.params;
    const investorId             = req.user!.userId;

    const milestone = await approveMilestone(jobId, milestoneId, investorId);
    sendSuccess(res, milestone);
  } catch (err) {
    handleError(res, err);
  }
}

// POST /api/escrow/:jobId/milestones/:milestoneId/dispute
export async function disputeMilestoneHandler(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, milestoneId } = req.params;
    const investorId             = req.user!.userId;
    const { reason }             = req.body as { reason: string };

    const milestone = await disputeMilestone(jobId, milestoneId, investorId, reason);
    sendSuccess(res, milestone);
  } catch (err) {
    handleError(res, err);
  }
}

// POST /api/escrow/:jobId/milestones/:milestoneId/resolve-dispute
export async function resolveDisputeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, milestoneId } = req.params;
    const { resolution }         = req.body as { resolution: 'RELEASE' | 'REFUND' };

    const milestone = await resolveDispute(jobId, milestoneId, resolution);
    sendSuccess(res, milestone);
  } catch (err) {
    handleError(res, err);
  }
}
