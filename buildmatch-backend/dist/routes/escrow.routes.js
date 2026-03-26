"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const escrow_schemas_1 = require("../schemas/escrow.schemas");
const escrow_controller_1 = require("../controllers/escrow.controller");
const router = (0, express_1.Router)();
// Fund a job — creates EscrowPayment + Stripe PaymentIntent
router.post('/fund-job/:jobId', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('INVESTOR'), (0, validate_middleware_1.validate)(escrow_schemas_1.fundJobSchema), escrow_controller_1.fundJobHandler);
// Get escrow details — investor or awarded contractor
router.get('/:jobId', auth_middleware_1.authenticate, escrow_controller_1.getEscrowHandler);
// Milestone actions — ordered before /:jobId param routes would conflict
router.post('/:jobId/milestones/:milestoneId/submit', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('CONTRACTOR'), (0, validate_middleware_1.validate)(escrow_schemas_1.submitMilestoneSchema), escrow_controller_1.submitMilestoneHandler);
router.post('/:jobId/milestones/:milestoneId/approve', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('INVESTOR'), escrow_controller_1.approveMilestoneHandler);
router.post('/:jobId/milestones/:milestoneId/dispute', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('INVESTOR'), (0, validate_middleware_1.validate)(escrow_schemas_1.disputeMilestoneSchema), escrow_controller_1.disputeMilestoneHandler);
router.post('/:jobId/milestones/:milestoneId/resolve-dispute', auth_middleware_1.authenticate, (0, auth_middleware_1.requireRole)('ADMIN'), (0, validate_middleware_1.validate)(escrow_schemas_1.resolveDisputeSchema), escrow_controller_1.resolveDisputeHandler);
exports.default = router;
//# sourceMappingURL=escrow.routes.js.map