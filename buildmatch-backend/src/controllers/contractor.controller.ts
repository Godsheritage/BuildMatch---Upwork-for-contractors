import type { Request, Response } from 'express';
import * as contractorService from '../services/contractor.service';
import { sendSuccess, sendError } from '../utils/response.utils';

export async function getAll(req: Request, res: Response): Promise<void> {
  try {
    const contractors = await contractorService.getAllContractors();
    sendSuccess(res, contractors);
  } catch (err) {
    sendError(res, (err as Error).message, 500);
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const contractor = await contractorService.getContractorById(req.params.id);
    sendSuccess(res, contractor);
  } catch (err) {
    sendError(res, (err as Error).message, 404);
  }
}

export async function upsertProfile(req: Request, res: Response): Promise<void> {
  try {
    const profile = await contractorService.upsertContractorProfile(req.user!.userId, req.body);
    sendSuccess(res, profile);
  } catch (err) {
    sendError(res, (err as Error).message, 400);
  }
}
