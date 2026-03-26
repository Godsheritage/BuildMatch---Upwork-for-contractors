"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fundJobHandler = fundJobHandler;
exports.getEscrowHandler = getEscrowHandler;
exports.submitMilestoneHandler = submitMilestoneHandler;
exports.approveMilestoneHandler = approveMilestoneHandler;
exports.disputeMilestoneHandler = disputeMilestoneHandler;
exports.resolveDisputeHandler = resolveDisputeHandler;
const response_utils_1 = require("../utils/response.utils");
const app_error_1 = require("../utils/app-error");
const escrow_service_1 = require("../services/escrow.service");
function handleError(res, err) {
    if (err instanceof app_error_1.AppError) {
        (0, response_utils_1.sendError)(res, err.message, err.statusCode);
    }
    else {
        (0, response_utils_1.sendError)(res, 'Internal server error', 500);
    }
}
// POST /api/escrow/fund-job/:jobId
async function fundJobHandler(req, res) {
    try {
        const { jobId } = req.params;
        const investorId = req.user.userId;
        const { milestones } = req.body;
        const result = await (0, escrow_service_1.fundJob)(jobId, investorId, milestones);
        (0, response_utils_1.sendSuccess)(res, result, 'Escrow created', 201);
    }
    catch (err) {
        handleError(res, err);
    }
}
// GET /api/escrow/:jobId
async function getEscrowHandler(req, res) {
    try {
        const { jobId } = req.params;
        const userId = req.user.userId;
        const role = req.user.role;
        const escrow = await (0, escrow_service_1.getEscrow)(jobId, userId, role);
        (0, response_utils_1.sendSuccess)(res, escrow);
    }
    catch (err) {
        handleError(res, err);
    }
}
// POST /api/escrow/:jobId/milestones/:milestoneId/submit
async function submitMilestoneHandler(req, res) {
    try {
        const { jobId, milestoneId } = req.params;
        const contractorId = req.user.userId;
        const { completionNotes } = req.body;
        const milestone = await (0, escrow_service_1.submitMilestone)(jobId, milestoneId, contractorId, completionNotes);
        (0, response_utils_1.sendSuccess)(res, milestone);
    }
    catch (err) {
        handleError(res, err);
    }
}
// POST /api/escrow/:jobId/milestones/:milestoneId/approve
async function approveMilestoneHandler(req, res) {
    try {
        const { jobId, milestoneId } = req.params;
        const investorId = req.user.userId;
        const milestone = await (0, escrow_service_1.approveMilestone)(jobId, milestoneId, investorId);
        (0, response_utils_1.sendSuccess)(res, milestone);
    }
    catch (err) {
        handleError(res, err);
    }
}
// POST /api/escrow/:jobId/milestones/:milestoneId/dispute
async function disputeMilestoneHandler(req, res) {
    try {
        const { jobId, milestoneId } = req.params;
        const investorId = req.user.userId;
        const { reason } = req.body;
        const milestone = await (0, escrow_service_1.disputeMilestone)(jobId, milestoneId, investorId, reason);
        (0, response_utils_1.sendSuccess)(res, milestone);
    }
    catch (err) {
        handleError(res, err);
    }
}
// POST /api/escrow/:jobId/milestones/:milestoneId/resolve-dispute
async function resolveDisputeHandler(req, res) {
    try {
        const { jobId, milestoneId } = req.params;
        const { resolution } = req.body;
        const milestone = await (0, escrow_service_1.resolveDispute)(jobId, milestoneId, resolution);
        (0, response_utils_1.sendSuccess)(res, milestone);
    }
    catch (err) {
        handleError(res, err);
    }
}
//# sourceMappingURL=escrow.controller.js.map