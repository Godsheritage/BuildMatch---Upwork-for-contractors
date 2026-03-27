import { Router } from 'express';
import {
  listJobs, getJobById, createJob, updateJob, cancelJob, getMyJobs,
  addJobPhotos, removeJobPhoto,
  createBid, getJobBids, getMyBid, getMyBids, acceptBid, withdrawBid,
} from '../controllers/job.controller';
import { createMessage, getJobMessages } from '../controllers/message.controller';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createJobSchema, updateJobSchema, addPhotosSchema, removePhotoSchema, createBidSchema } from '../schemas/job.schemas';
import { createMessageSchema } from '../schemas/ai.schemas';

const router = Router();

// ── Job routes ────────────────────────────────────────────────────────────────
// NOTE: /my-jobs must be declared before /:id to prevent param capture

router.get('/my-jobs', authenticate, requireRole('INVESTOR'),   getMyJobs);
router.get('/my-bids', authenticate, requireRole('CONTRACTOR'), getMyBids);
router.get('/',        listJobs);
router.get('/:id',     optionalAuthenticate, getJobById);

router.post('/',      authenticate, requireRole('INVESTOR'), validate(createJobSchema), createJob);
router.put('/:id',    authenticate, requireRole('INVESTOR'), validate(updateJobSchema), updateJob);
router.delete('/:id', authenticate, requireRole('INVESTOR'), cancelJob);

// ── Photo routes ──────────────────────────────────────────────────────────────

router.post('/:jobId/photos',   authenticate, requireRole('INVESTOR'), validate(addPhotosSchema),   addJobPhotos);
router.delete('/:jobId/photos', authenticate, requireRole('INVESTOR'), validate(removePhotoSchema), removeJobPhoto);

// ── Bid routes ────────────────────────────────────────────────────────────────
// NOTE: /my-bid must be declared before /:bidId/... to prevent param capture

router.get('/:jobId/bids/my-bid', authenticate, requireRole('CONTRACTOR'), getMyBid);
router.get('/:jobId/bids',        authenticate, getJobBids);

router.post('/:jobId/bids', authenticate, requireRole('CONTRACTOR'), validate(createBidSchema), createBid);

router.put('/:jobId/bids/:bidId/accept',   authenticate, requireRole('INVESTOR'),   acceptBid);
router.put('/:jobId/bids/:bidId/withdraw', authenticate, requireRole('CONTRACTOR'), withdrawBid);

// ── Message routes ────────────────────────────────────────────────────────────

router.get( '/:jobId/messages', authenticate, getJobMessages);
router.post('/:jobId/messages', authenticate, validate(createMessageSchema), createMessage);

export default router;
