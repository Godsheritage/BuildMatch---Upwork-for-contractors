import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import * as svc from '../services/property.service';
import { generatePropertyEstimate } from '../services/ai/property-estimator.service';

const router = Router();
router.use(authenticate);

// ── Schemas ──────────────────────────────────────────────────────────────────

const createPropertySchema = z.object({
  address_line1: z.string().min(3).max(200),
  address_line2: z.string().max(200).optional(),
  city:          z.string().min(1).max(100),
  state:         z.string().min(2).max(50),
  zip_code:      z.string().min(3).max(20),
  property_type: z.enum([
    'SINGLE_FAMILY', 'DUPLEX', 'TRIPLEX', 'FOURPLEX',
    'TOWNHOUSE', 'CONDO', 'MULTI_FAMILY', 'COMMERCIAL',
  ]),
  year_built:    z.number().int().min(1700).max(2030).optional(),
  sqft_estimate: z.number().int().min(100).max(100000).optional(),
  bedrooms:      z.number().int().min(0).max(50).optional(),
  bathrooms:     z.number().min(0).max(50).optional(),
  has_basement:  z.boolean().optional(),
  has_garage:    z.boolean().optional(),
  stories:       z.number().int().min(1).max(10).optional(),
});

const createEstimateSchema = z.object({
  property_id:        z.string().uuid(),
  renovation_purpose: z.enum(['FLIP', 'RENTAL', 'PRIMARY_RESIDENCE', 'WHOLESALE']),
  primary_issue:      z.enum([
    'COSMETIC', 'FULL_GUT', 'WATER_DAMAGE', 'FIRE_DAMAGE',
    'NEGLECT', 'STRUCTURAL', 'PARTIAL',
  ]),
});

const addPhotoSchema = z.object({
  area_key:     z.string().min(1).max(50),
  area_label:   z.string().min(1).max(100),
  url:          z.string().url(),
  storage_path: z.string().min(1),
  caption:      z.string().max(200).optional(),
  sort_order:   z.number().int().min(0).optional(),
});

const answersSchema = z.object({
  answers: z.array(z.object({
    question_key: z.string().min(1),
    answer:       z.string().min(1),
  })).min(1),
});

// ── Properties ───────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await svc.listProperties(req.user!.userId);
    sendSuccess(res, rows);
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to load properties', 500);
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await svc.getProperty(req.params.id, req.user!.userId);
    sendSuccess(res, row);
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to load property', 500);
  }
});

router.post('/', validate(createPropertySchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await svc.createProperty(req.user!.userId, req.body);
    sendSuccess(res, row, 'Property added', 201);
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to create property', 500);
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await svc.deleteProperty(req.params.id, req.user!.userId);
    sendSuccess(res, null, 'Property deleted');
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to delete property', 500);
  }
});

// ── Estimates ────────────────────────────────────────────────────────────────

router.get('/:propertyId/estimates', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await svc.listEstimates(req.params.propertyId, req.user!.userId);
    sendSuccess(res, rows);
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to load estimates', 500);
  }
});

router.get('/estimates/:estimateId', async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await svc.getEstimate(req.params.estimateId, req.user!.userId);
    sendSuccess(res, row);
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to load estimate', 500);
  }
});

router.post('/estimates', validate(createEstimateSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const estimate = await svc.createEstimate(req.user!.userId, req.body);
    sendSuccess(res, estimate, 'Estimate created', 201);
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to create estimate', 500);
  }
});

// ── Photos ───────────────────────────────────────────────────────────────────

router.get('/estimates/:estimateId/photos', async (req: Request, res: Response): Promise<void> => {
  try {
    await svc.getEstimate(req.params.estimateId, req.user!.userId);
    const rows = await svc.getEstimatePhotos(req.params.estimateId);
    sendSuccess(res, rows);
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to load photos', 500);
  }
});

router.post('/estimates/:estimateId/photos', validate(addPhotoSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const est = await svc.getEstimate(req.params.estimateId, req.user!.userId);
    const photo = await svc.addEstimatePhoto({
      estimate_id:  req.params.estimateId,
      property_id:  est.property_id,
      ...req.body,
    });
    sendSuccess(res, photo, 'Photo added', 201);
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to add photo', 500);
  }
});

// ── Answers ──────────────────────────────────────────────────────────────────

router.put('/estimates/:estimateId/answers', validate(answersSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    await svc.getEstimate(req.params.estimateId, req.user!.userId);
    await svc.upsertAnswers(req.params.estimateId, req.body.answers);
    sendSuccess(res, null, 'Answers saved');
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to save answers', 500);
  }
});

// ── Run AI estimation ────────────────────────────────────────────────────────

router.post('/estimates/:estimateId/run', async (req: Request, res: Response): Promise<void> => {
  try {
    const estimate = await svc.getEstimate(req.params.estimateId, req.user!.userId);
    if (estimate.status === 'COMPLETE') {
      sendError(res, 'Estimate already completed', 400);
      return;
    }
    const property = await svc.getProperty(estimate.property_id, req.user!.userId);
    const photos   = await svc.getEstimatePhotos(estimate.id);
    const answers  = await svc.getAnswers(estimate.id);

    const answersMap: Record<string, string> = {};
    for (const a of answers) answersMap[a.question_key] = a.answer;

    // Fire-and-forget — run in background so the response is instant
    void generatePropertyEstimate({
      estimateId:          estimate.id,
      propertyAddress:     `${property.address_line1}, ${property.city}, ${property.state} ${property.zip_code}`,
      zipCode:             property.zip_code,
      propertyType:        property.property_type,
      yearBuilt:           property.year_built,
      sqftEstimate:        property.sqft_estimate,
      bedrooms:            property.bedrooms ?? 0,
      bathrooms:           property.bathrooms ?? 0,
      hasBasement:         property.has_basement,
      hasGarage:           property.has_garage,
      stories:             property.stories,
      renovationPurpose:   estimate.renovation_purpose,
      primaryIssue:        estimate.primary_issue,
      questionnaireAnswers: answersMap,
      photos:              photos.map(p => ({
        areaKey:   p.area_key,
        areaLabel: p.area_label,
        url:       p.url,
        caption:   p.caption,
      })),
      investorId:          req.user!.userId,
    }).catch(console.error);

    sendSuccess(res, { status: 'PROCESSING' }, 'Estimation started');
  } catch (err) {
    if (err instanceof AppError) sendError(res, err.message, err.statusCode);
    else sendError(res, 'Failed to start estimation', 500);
  }
});

export default router;
