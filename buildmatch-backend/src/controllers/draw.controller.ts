import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import {
  previewDrawSchedule,
  createDrawSchedule,
  getDrawSchedule,
  updateMilestone,
  approveSchedule,
  submitDrawRequest,
  reviewDrawRequest,
  addDrawEvidence,
  listDrawRequests,
} from '../services/draw.service';
import { getTemplateForTrade } from '../services/ai/draw-schedule.service';

// ── GET /api/draws/jobs/:jobId/preview ─────────────────────────────────────────
export async function previewSchedule(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const totalAmount = Number(req.query.totalAmount);
    if (!totalAmount || totalAmount <= 0) {
      sendError(res, 'totalAmount query param is required and must be positive', 400);
      return;
    }
    const result = await previewDrawSchedule(jobId, totalAmount);
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

// ── GET /api/draws/templates/:tradeType ────────────────────────────────────────
export async function getTemplate(req: Request, res: Response): Promise<void> {
  const templates = getTemplateForTrade(req.params.tradeType.toUpperCase());
  sendSuccess(res, { templates });
}

// ── POST /api/draws/jobs/:jobId ────────────────────────────────────────────────
export async function createSchedule(req: Request, res: Response): Promise<void> {
  try {
    const schedule = await createDrawSchedule(req.params.jobId, req.user!.userId, req.body);
    sendSuccess(res, schedule, undefined, 201);
  } catch (err) {
    handleError(res, err);
  }
}

// ── GET /api/draws/jobs/:jobId ─────────────────────────────────────────────────
export async function getSchedule(req: Request, res: Response): Promise<void> {
  try {
    const schedule = await getDrawSchedule(req.params.jobId, req.user!.userId);
    sendSuccess(res, schedule);
  } catch (err) {
    handleError(res, err);
  }
}

// ── PATCH /api/draws/jobs/:jobId/milestones/:milestoneId ───────────────────────
export async function patchMilestone(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, milestoneId } = req.params;
    const updated = await updateMilestone(jobId, milestoneId, req.user!.userId, req.body);
    sendSuccess(res, updated);
  } catch (err) {
    handleError(res, err);
  }
}

// ── POST /api/draws/jobs/:jobId/approve ────────────────────────────────────────
export async function approveDrawSchedule(req: Request, res: Response): Promise<void> {
  try {
    const schedule = await approveSchedule(req.params.jobId, req.user!.userId);
    sendSuccess(res, schedule);
  } catch (err) {
    handleError(res, err);
  }
}

// ── POST /api/draws/jobs/:jobId/milestones/:milestoneId/request ────────────────
export async function requestDraw(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, milestoneId } = req.params;
    const request = await submitDrawRequest(jobId, milestoneId, req.user!.userId, req.body);
    sendSuccess(res, request, undefined, 201);
  } catch (err) {
    handleError(res, err);
  }
}

// ── POST /api/draws/jobs/:jobId/requests/:requestId/review ────────────────────
export async function reviewRequest(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, requestId } = req.params;
    const result = await reviewDrawRequest(jobId, requestId, req.user!.userId, req.body);
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

// ── POST /api/draws/jobs/:jobId/requests/:requestId/evidence ──────────────────
export async function addEvidence(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, requestId } = req.params;
    const evidence = await addDrawEvidence(jobId, requestId, req.user!.userId, req.body);
    sendSuccess(res, evidence, undefined, 201);
  } catch (err) {
    handleError(res, err);
  }
}

// ── GET /api/draws/jobs/:jobId/requests ───────────────────────────────────────
export async function getRequests(req: Request, res: Response): Promise<void> {
  try {
    const requests = await listDrawRequests(req.params.jobId, req.user!.userId);
    sendSuccess(res, requests);
  } catch (err) {
    handleError(res, err);
  }
}

// ── Error helper ──────────────────────────────────────────────────────────────
function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
  } else {
    console.error('[draw.controller]', err);
    sendError(res, 'Unexpected error', 500);
  }
}
