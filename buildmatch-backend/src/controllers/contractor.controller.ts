import type { Request, Response } from 'express';
import * as contractorService from '../services/contractor.service';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import { getServiceClient } from '../lib/supabase';

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

    // Fire-and-forget: log text searches so /admin/analytics/search-gaps can
    // surface unmet demand.  Only fires when a `search` param is present.
    // Never blocks the response — errors are silently discarded.
    const searchText = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (searchText) {
      getServiceClient()
        .from('search_log')
        .insert({
          query:        searchText.toLowerCase(),
          filters:      {
            state:     req.query.state     ?? null,
            city:      req.query.city      ?? null,
            specialty: req.query.specialty ?? null,
            minRating: req.query.minRating ?? null,
            available: req.query.available ?? null,
          },
          result_count: result.total,
          user_id:      req.user?.userId ?? null,
        })
        .then(
          () => { /* ok */ },
          () => { /* non-fatal — never block the response */ },
        );
    }

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
