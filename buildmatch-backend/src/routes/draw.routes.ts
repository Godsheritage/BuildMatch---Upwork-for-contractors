import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  generateDrawScheduleSchema,
  createDrawScheduleSchema,
  updateMilestoneSchema,
  approveScheduleSchema,
  submitDrawRequestSchema,
  reviewDrawRequestSchema,
  addEvidenceSchema,
} from '../schemas/draw.schemas';
import {
  previewSchedule,
  getTemplate,
  createSchedule,
  getSchedule,
  patchMilestone,
  approveDrawSchedule,
  requestDraw,
  reviewRequest,
  addEvidence,
  getRequests,
} from '../controllers/draw.controller';

const router = Router();

// ── Public-ish: templates (no auth needed, referenced by frontend before login) ─
router.get('/templates/:tradeType', getTemplate);

// ── All other routes require authentication ────────────────────────────────────
router.use(authenticate);

// ── Schedule-level routes ──────────────────────────────────────────────────────
// Static segments before dynamic params:
router.get( '/jobs/:jobId/preview',  previewSchedule);
router.post('/jobs/:jobId/approve',  validate(approveScheduleSchema), approveDrawSchedule);
router.get( '/jobs/:jobId/requests', getRequests);
router.get( '/jobs/:jobId',          getSchedule);
router.post('/jobs/:jobId',          validate(createDrawScheduleSchema), createSchedule);

// ── Milestone routes ───────────────────────────────────────────────────────────
router.patch('/jobs/:jobId/milestones/:milestoneId',         validate(updateMilestoneSchema),    patchMilestone);
router.post( '/jobs/:jobId/milestones/:milestoneId/request', validate(submitDrawRequestSchema),  requestDraw);

// ── Draw request routes ────────────────────────────────────────────────────────
router.post('/jobs/:jobId/requests/:requestId/review',   validate(reviewDrawRequestSchema), reviewRequest);
router.post('/jobs/:jobId/requests/:requestId/evidence', validate(addEvidenceSchema),       addEvidence);

export default router;
