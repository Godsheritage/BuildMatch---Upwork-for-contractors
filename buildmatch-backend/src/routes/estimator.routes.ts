import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { sendSuccess, sendError } from '../utils/response.utils';
import { AppError } from '../utils/app-error';
import { getServiceClient } from '../lib/supabase';
import * as svc from '../services/property.service';
import { generatePropertyEstimate } from '../services/ai/property-estimator.service';

const router = Router();
router.use(authenticate);
router.use(requireRole('INVESTOR'));

function db() { return getServiceClient(); }

function handle(res: Response, err: unknown): void {
  if (err instanceof AppError) sendError(res, err.message, err.statusCode);
  else { console.error('[estimator]', err); sendError(res, 'Something went wrong', 500); }
}

// ────────────────────────────────────────────────────────────────────────────
// ── Properties ──────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────

const createPropertySchema = z.object({
  addressLine1:  z.string().min(5).max(200),
  addressLine2:  z.string().max(100).optional(),
  city:          z.string().min(2).max(100),
  state:         z.string().length(2),
  zipCode:       z.string().regex(/^\d{5}$/, 'Must be a 5-digit ZIP code'),
  propertyType:  z.enum([
    'SINGLE_FAMILY', 'DUPLEX', 'TRIPLEX', 'FOURPLEX',
    'TOWNHOUSE', 'CONDO', 'MULTI_FAMILY', 'COMMERCIAL',
  ]),
  yearBuilt:     z.number().int().min(1800).max(2024).optional(),
  sqftEstimate:  z.number().int().min(100).max(50000).optional(),
  bedrooms:      z.number().int().min(0).max(20),
  bathrooms:     z.number().min(0).max(20),
  hasBasement:   z.boolean().default(false),
  hasGarage:     z.boolean().default(false),
  stories:       z.number().int().min(1).max(10).default(1),
});

// POST /api/estimator/properties
router.post(
  '/properties',
  validate(createPropertySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const b = req.body as z.infer<typeof createPropertySchema>;
      const prop = await svc.createProperty(req.user!.userId, {
        address_line1: b.addressLine1,
        address_line2: b.addressLine2,
        city:          b.city,
        state:         b.state,
        zip_code:      b.zipCode,
        property_type: b.propertyType,
        year_built:    b.yearBuilt,
        sqft_estimate: b.sqftEstimate,
        bedrooms:      b.bedrooms,
        bathrooms:     b.bathrooms,
        has_basement:  b.hasBasement,
        has_garage:    b.hasGarage,
        stories:       b.stories,
      });
      sendSuccess(res, prop, 'Property created', 201);
    } catch (err) { handle(res, err); }
  },
);

// GET /api/estimator/properties
router.get('/properties', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const properties = await svc.listProperties(userId);

    // Enrich each property with its latest estimate status + total range
    const enriched = await Promise.all(
      properties.map(async (p) => {
        const { data: ests } = await db()
          .from('property_estimates')
          .select('id, status, total_low, total_high, created_at')
          .eq('property_id', p.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const latest = (ests && ests.length > 0)
          ? (ests[0] as { id: string; status: string; total_low: number | null; total_high: number | null; created_at: string })
          : null;

        return {
          ...p,
          latestEstimate: latest
            ? {
                id:       latest.id,
                status:   latest.status,
                totalLow:  latest.total_low,
                totalHigh: latest.total_high,
                createdAt: latest.created_at,
              }
            : null,
        };
      }),
    );

    sendSuccess(res, enriched);
  } catch (err) { handle(res, err); }
});

// ────────────────────────────────────────────────────────────────────────────
// ── Estimates ───────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────

const createEstimateSchema = z.object({
  propertyId:           z.string().uuid(),
  renovationPurpose:    z.enum(['FLIP', 'RENTAL', 'PRIMARY_RESIDENCE', 'WHOLESALE']),
  primaryIssue:         z.enum([
    'COSMETIC', 'FULL_GUT', 'WATER_DAMAGE', 'FIRE_DAMAGE',
    'NEGLECT', 'STRUCTURAL', 'PARTIAL',
  ]),
  questionnaireAnswers: z.record(z.string(), z.string()),
  photoIds:             z.array(z.string().uuid()).min(4).max(40),
});

// POST /api/estimator/estimates
router.post(
  '/estimates',
  validate(createEstimateSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const b = req.body as z.infer<typeof createEstimateSchema>;

      // Validate property ownership
      const property = await svc.getProperty(b.propertyId, userId);

      // Validate all photoIds belong to this property
      const { data: photoRows, error: photoErr } = await db()
        .from('estimate_photos')
        .select('id, area_key, area_label, url, storage_path, caption')
        .eq('property_id', b.propertyId)
        .in('id', b.photoIds);

      if (photoErr || !photoRows) throw new AppError('Failed to verify photos', 500);

      const foundIds = new Set((photoRows as { id: string }[]).map(r => r.id));
      const missing  = b.photoIds.filter(id => !foundIds.has(id));
      if (missing.length > 0) {
        sendError(res, `Some photo IDs were not found: ${missing.join(', ')}`, 400);
        return;
      }

      // Validate at least 4 unique area keys
      const photos = photoRows as svc.EstimatePhoto[];
      const uniqueAreas = new Set(photos.map(p => p.area_key));
      if (uniqueAreas.size < 4) {
        sendError(res, `At least 4 different photo areas required (got ${uniqueAreas.size}). Include interior + at least 2 specific room areas.`, 400);
        return;
      }

      // Create estimate record
      const estimate = await svc.createEstimate(userId, {
        property_id:        b.propertyId,
        renovation_purpose: b.renovationPurpose,
        primary_issue:      b.primaryIssue,
      });

      // Save questionnaire answers
      const ansArray = Object.entries(b.questionnaireAnswers)
        .filter(([, v]) => (v as string).trim())
        .map(([k, v]) => ({ question_key: k, answer: v as string }));
      if (ansArray.length > 0) {
        await svc.upsertAnswers(estimate.id, ansArray);
      }

      // Link photos to this estimate
      await db()
        .from('estimate_photos')
        .update({ estimate_id: estimate.id })
        .in('id', b.photoIds);

      // Start async AI processing (fire-and-forget)
      void generatePropertyEstimate({
        estimateId:           estimate.id,
        propertyAddress:      `${property.address_line1}, ${property.city}, ${property.state} ${property.zip_code}`,
        zipCode:              property.zip_code,
        propertyType:         property.property_type,
        yearBuilt:            property.year_built,
        sqftEstimate:         property.sqft_estimate,
        bedrooms:             property.bedrooms ?? 0,
        bathrooms:            property.bathrooms ?? 0,
        hasBasement:          property.has_basement,
        hasGarage:            property.has_garage,
        stories:              property.stories,
        renovationPurpose:    b.renovationPurpose,
        primaryIssue:         b.primaryIssue,
        questionnaireAnswers: b.questionnaireAnswers as Record<string, string>,
        photos:               photos.map(p => ({
          areaKey:   p.area_key,
          areaLabel: p.area_label,
          url:       p.url,
          caption:   p.caption,
        })),
        investorId:           userId,
      }).catch(err => {
        console.error('Estimate failed:', estimate.id, err);
      });

      sendSuccess(res, { estimateId: estimate.id, status: 'PROCESSING' }, 'Estimation started', 202);
    } catch (err) { handle(res, err); }
  },
);

// GET /api/estimator/estimates/:estimateId
router.get('/estimates/:estimateId', async (req: Request, res: Response): Promise<void> => {
  try {
    const estimate = await svc.getEstimate(req.params.estimateId, req.user!.userId);

    if (estimate.status === 'PROCESSING') {
      sendSuccess(res, { status: 'PROCESSING', message: 'Analysis in progress' });
      return;
    }
    if (estimate.status === 'FAILED') {
      sendSuccess(res, {
        status:  'FAILED',
        message: estimate.ai_summary || 'Analysis failed. Please try again.',
      });
      return;
    }

    sendSuccess(res, estimate);
  } catch (err) { handle(res, err); }
});

// GET /api/estimator/estimates/:estimateId/poll
router.get('/estimates/:estimateId/poll', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await db()
      .from('property_estimates')
      .select('status, total_low, total_high, processing_finished')
      .eq('id', req.params.estimateId)
      .single();

    if (error || !data) { sendError(res, 'Estimate not found', 404); return; }

    const row = data as {
      status: string; total_low: number | null; total_high: number | null;
      processing_finished: string | null;
    };

    // Lightweight ownership check
    const { data: estRow } = await db()
      .from('property_estimates')
      .select('investor_id')
      .eq('id', req.params.estimateId)
      .single();
    if (!estRow || (estRow as { investor_id: string }).investor_id !== req.user!.userId) {
      sendError(res, 'Not found', 404);
      return;
    }

    sendSuccess(res, {
      status:    row.status,
      totalLow:  row.total_low,
      totalHigh: row.total_high,
      updatedAt: row.processing_finished,
    });
  } catch (err) { handle(res, err); }
});

// GET /api/estimator/properties/:propertyId/estimates
router.get('/properties/:propertyId/estimates', async (req: Request, res: Response): Promise<void> => {
  try {
    // Ownership check
    await svc.getProperty(req.params.propertyId, req.user!.userId);

    const { data, error } = await db()
      .from('property_estimates')
      .select('id, status, total_low, total_high, confidence_overall, renovation_purpose, primary_issue, photo_count, created_at')
      .eq('property_id', req.params.propertyId)
      .order('created_at', { ascending: false });

    if (error) throw new AppError('Failed to load estimates', 500);

    const estimates = (data ?? []).map((r: Record<string, unknown>) => ({
      id:                r.id,
      status:            r.status,
      totalLow:          r.total_low,
      totalHigh:         r.total_high,
      confidenceOverall: r.confidence_overall,
      renovationPurpose: r.renovation_purpose,
      primaryIssue:      r.primary_issue,
      photoCount:        r.photo_count,
      createdAt:         r.created_at,
    }));

    sendSuccess(res, estimates);
  } catch (err) { handle(res, err); }
});

// ────────────────────────────────────────────────────────────────────────────
// ── Photo uploads ───────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────

const addPhotoSchema = z.object({
  propertyId:   z.string().uuid(),
  areaKey:      z.string().min(1).max(50),
  areaLabel:    z.string().min(1).max(100),
  url:          z.string().url(),
  storagePath:  z.string().min(1),
  caption:      z.string().max(200).optional(),
  sortOrder:    z.number().int().optional(),
});

// Validate a Supabase Storage URL for the estimate-photos bucket
const ESTIMATE_PHOTOS_URL_RE = /\/storage\/v1\/object\/public\/estimate-photos\//;

// POST /api/estimator/photos
router.post(
  '/photos',
  validate(addPhotoSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const b = req.body as z.infer<typeof addPhotoSchema>;

      // Ownership check
      await svc.getProperty(b.propertyId, userId);

      // URL validation
      if (!ESTIMATE_PHOTOS_URL_RE.test(b.url)) {
        sendError(res, 'URL must be a Supabase Storage URL for the estimate-photos bucket', 400);
        return;
      }

      // Insert with null estimate_id — will be linked when estimate is created
      const photo = await svc.addEstimatePhoto({
        estimate_id:  null as unknown as string,  // nullable in DB
        property_id:  b.propertyId,
        area_key:     b.areaKey,
        area_label:   b.areaLabel,
        url:          b.url,
        storage_path: b.storagePath,
        caption:      b.caption,
        sort_order:   b.sortOrder,
      });

      sendSuccess(res, photo, 'Photo added', 201);
    } catch (err) { handle(res, err); }
  },
);

// DELETE /api/estimator/photos/:photoId
router.delete('/photos/:photoId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Fetch the photo
    const { data: photoData, error: photoErr } = await db()
      .from('estimate_photos')
      .select('id, property_id, storage_path')
      .eq('id', req.params.photoId)
      .single();

    if (photoErr || !photoData) {
      sendError(res, 'Photo not found', 404);
      return;
    }

    const photo = photoData as { id: string; property_id: string; storage_path: string };

    // Verify ownership via property
    await svc.getProperty(photo.property_id, userId);

    // Delete from Supabase Storage
    const { error: storageErr } = await db().storage
      .from('estimate-photos')
      .remove([photo.storage_path]);

    if (storageErr) {
      console.error('[estimator] storage delete failed:', storageErr.message);
      // Non-fatal — still delete the DB record
    }

    // Delete DB record
    const { error: deleteErr } = await db()
      .from('estimate_photos')
      .delete()
      .eq('id', req.params.photoId);

    if (deleteErr) throw new AppError('Failed to delete photo', 500);

    sendSuccess(res, null, 'Photo deleted');
  } catch (err) { handle(res, err); }
});

export default router;
