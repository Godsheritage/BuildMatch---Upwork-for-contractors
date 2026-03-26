"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listJobs = listJobs;
exports.getJobById = getJobById;
exports.createJob = createJob;
exports.updateJob = updateJob;
exports.cancelJob = cancelJob;
exports.getMyJobs = getMyJobs;
exports.createBid = createBid;
exports.getJobBids = getJobBids;
exports.getMyBid = getMyBid;
exports.acceptBid = acceptBid;
exports.withdrawBid = withdrawBid;
const jobService = __importStar(require("../services/job.service"));
const app_error_1 = require("../utils/app-error");
const response_utils_1 = require("../utils/response.utils");
function handleError(res, err) {
    if (err instanceof app_error_1.AppError) {
        (0, response_utils_1.sendError)(res, err.message, err.statusCode);
    }
    else {
        (0, response_utils_1.sendError)(res, 'Something went wrong', 500);
    }
}
// ── Job handlers ─────────────────────────────────────────────────────────────
async function listJobs(req, res) {
    try {
        const { page, limit, tradeType, state, city, minBudget, maxBudget, status, search } = req.query;
        const result = await jobService.listJobs({
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            minBudget: minBudget ? parseFloat(minBudget) : undefined,
            maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
            tradeType: tradeType,
            state: state,
            city: city,
            status: status,
            search: search,
        });
        (0, response_utils_1.sendSuccess)(res, result);
    }
    catch (err) {
        handleError(res, err);
    }
}
async function getJobById(req, res) {
    try {
        const job = await jobService.getJobById(req.params.id, req.user?.userId);
        (0, response_utils_1.sendSuccess)(res, job);
    }
    catch (err) {
        handleError(res, err);
    }
}
async function createJob(req, res) {
    try {
        const job = await jobService.createJob(req.user.userId, req.body);
        (0, response_utils_1.sendSuccess)(res, job, 'Job created', 201);
    }
    catch (err) {
        handleError(res, err);
    }
}
async function updateJob(req, res) {
    try {
        const job = await jobService.updateJob(req.params.id, req.user.userId, req.body);
        (0, response_utils_1.sendSuccess)(res, job);
    }
    catch (err) {
        handleError(res, err);
    }
}
async function cancelJob(req, res) {
    try {
        const job = await jobService.cancelJob(req.params.id, req.user.userId);
        (0, response_utils_1.sendSuccess)(res, job, 'Job cancelled');
    }
    catch (err) {
        handleError(res, err);
    }
}
async function getMyJobs(req, res) {
    try {
        const jobs = await jobService.getMyJobs(req.user.userId);
        (0, response_utils_1.sendSuccess)(res, jobs);
    }
    catch (err) {
        handleError(res, err);
    }
}
// ── Bid handlers ─────────────────────────────────────────────────────────────
async function createBid(req, res) {
    try {
        const bid = await jobService.createBid(req.params.jobId, req.user.userId, req.body);
        (0, response_utils_1.sendSuccess)(res, bid, 'Bid submitted', 201);
    }
    catch (err) {
        handleError(res, err);
    }
}
async function getJobBids(req, res) {
    try {
        const bids = await jobService.getJobBids(req.params.jobId, req.user.userId, req.user.role);
        (0, response_utils_1.sendSuccess)(res, bids);
    }
    catch (err) {
        handleError(res, err);
    }
}
async function getMyBid(req, res) {
    try {
        const bid = await jobService.getMyBid(req.params.jobId, req.user.userId);
        (0, response_utils_1.sendSuccess)(res, bid);
    }
    catch (err) {
        handleError(res, err);
    }
}
async function acceptBid(req, res) {
    try {
        const bid = await jobService.acceptBid(req.params.jobId, req.params.bidId, req.user.userId);
        (0, response_utils_1.sendSuccess)(res, bid, 'Bid accepted');
    }
    catch (err) {
        handleError(res, err);
    }
}
async function withdrawBid(req, res) {
    try {
        const bid = await jobService.withdrawBid(req.params.jobId, req.params.bidId, req.user.userId);
        (0, response_utils_1.sendSuccess)(res, bid, 'Bid withdrawn');
    }
    catch (err) {
        handleError(res, err);
    }
}
//# sourceMappingURL=job.controller.js.map