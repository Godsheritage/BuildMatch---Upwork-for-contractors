import type { Request, Response } from 'express';
import * as contractorService from '../services/contractor.service';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';

function parsePositiveFloat(val: unknown): number | undefined {
  const n = parseFloat(val as string);
  return isNaN(n) ? undefined : n;
}

function parsePositiveInt(val: unknown): number | undefined {
  const n = parseInt(val as string, 10);
  return isNaN(n) ? undefined : n;
}

function parseBoolean(val: unknown): boolean | undefined {
  if (val === 'true') return true;
  if (val === 'false') return false;
  return undefined;
}

function handleError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
  } else {
    sendError(res, 'Internal server error', 500);
  }
}

export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const result = await contractorService.listContractors({
      page:      parsePositiveInt(req.query.page),
      limit:     parsePositiveInt(req.query.limit),
      specialty: req.query.specialty as string | undefined,
      state:     req.query.state as string | undefined,
      city:      req.query.city as string | undefined,
      minRating: parsePositiveFloat(req.query.minRating),
      available: parseBoolean(req.query.available),
      search:    req.query.search as string | undefined,
    });
    sendSuccess(res, result);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const contractor = await contractorService.getContractorById(req.params.id);
    sendSuccess(res, contractor);
  } catch (err) {
    handleError(res, err);
  }
}

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const profile = await contractorService.getMyProfile(req.user!.userId);
    sendSuccess(res, profile);
  } catch (err) {
    handleError(res, err);
  }
}

export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const profile = await contractorService.updateMyProfile(req.user!.userId, req.body);
    sendSuccess(res, profile);
  } catch (err) {
    handleError(res, err);
  }
}
