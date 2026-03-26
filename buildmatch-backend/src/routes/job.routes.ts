import { Router } from 'express';
import {
  listJobs, getJobById, createJob, updateJob, cancelJob, getMyJobs,
  createBid, getJobBids, getMyBid, acceptBid, withdrawBid,
} from '../controllers/job.controller';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createJobSchema, updateJobSchema, createBidSchema } from '../schemas/job.schemas';

const router = Router();

// ── Job routes ────────────────────────────────────────────────────────────────
// NOTE: /my-jobs must be declared before /:id to prevent param capture

router.get('/my-jobs', authenticate, requireRole('INVESTOR'), getMyJobs);
router.get('/',        listJobs);
router.get('/:id',     optionalAuthenticate, getJobById);

router.post('/',      authenticate, requireRole('INVESTOR'), validate(createJobSchema), createJob);
router.put('/:id',    authenticate, requireRole('INVESTOR'), validate(updateJobSchema), updateJob);
router.delete('/:id', authenticate, requireRole('INVESTOR'), cancelJob);

// ── Bid routes ────────────────────────────────────────────────────────────────
// NOTE: /my-bid must be declared before /:bidId/... to prevent param capture

router.get('/:jobId/bids/my-bid', authenticate, requireRole('CONTRACTOR'), getMyBid);
router.get('/:jobId/bids',        authenticate, getJobBids);

router.post('/:jobId/bids', authenticate, requireRole('CONTRACTOR'), validate(createBidSchema), createBid);

router.put('/:jobId/bids/:bidId/accept',   authenticate, requireRole('INVESTOR'),   acceptBid);
router.put('/:jobId/bids/:bidId/withdraw', authenticate, requireRole('CONTRACTOR'), withdrawBid);

export default router;
