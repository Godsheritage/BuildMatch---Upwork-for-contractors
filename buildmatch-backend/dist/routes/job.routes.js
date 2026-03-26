"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const job_controller_1 = require("../controllers/job.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const job_schemas_1 = require("../schemas/job.schemas");
const router = (0, express_1.Router)();
// ── Job routes ────────────────────────────────────────────────────────────────
// NOTE: /my-jobs must be declared before /:id to prevent param capture
router.get('/my-jobs', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('INVESTOR'), job_controller_1.getMyJobs);
router.get('/', job_controller_1.listJobs);
router.get('/:id', auth_middleware_1.optionalAuthenticate, job_controller_1.getJobById);
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('INVESTOR'), (0, validate_middleware_1.validate)(job_schemas_1.createJobSchema), job_controller_1.createJob);
router.put('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('INVESTOR'), (0, validate_middleware_1.validate)(job_schemas_1.updateJobSchema), job_controller_1.updateJob);
router.delete('/:id', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('INVESTOR'), job_controller_1.cancelJob);
// ── Bid routes ────────────────────────────────────────────────────────────────
// NOTE: /my-bid must be declared before /:bidId/... to prevent param capture
router.get('/:jobId/bids/my-bid', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('CONTRACTOR'), job_controller_1.getMyBid);
router.get('/:jobId/bids', auth_middleware_1.authenticate, job_controller_1.getJobBids);
router.post('/:jobId/bids', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('CONTRACTOR'), (0, validate_middleware_1.validate)(job_schemas_1.createBidSchema), job_controller_1.createBid);
router.put('/:jobId/bids/:bidId/accept', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('INVESTOR'), job_controller_1.acceptBid);
router.put('/:jobId/bids/:bidId/withdraw', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('CONTRACTOR'), job_controller_1.withdrawBid);
exports.default = router;
//# sourceMappingURL=job.routes.js.map