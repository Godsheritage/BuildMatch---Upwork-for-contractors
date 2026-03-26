"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJob = createJob;
exports.listJobs = listJobs;
exports.getJobById = getJobById;
exports.updateJob = updateJob;
exports.cancelJob = cancelJob;
exports.getMyJobs = getMyJobs;
exports.createBid = createBid;
exports.getJobBids = getJobBids;
exports.getMyBid = getMyBid;
exports.acceptBid = acceptBid;
exports.withdrawBid = withdrawBid;
const prisma_1 = __importDefault(require("../lib/prisma"));
const app_error_1 = require("../utils/app-error");
// ── Selects ──────────────────────────────────────────────────────────────────
const INVESTOR_SELECT = { select: { firstName: true, lastName: true } };
// ── Job services ─────────────────────────────────────────────────────────────
async function createJob(investorId, input) {
    return prisma_1.default.job.create({
        data: { ...input, investorId, status: 'OPEN' },
        include: { investor: INVESTOR_SELECT },
    });
}
async function listJobs(params) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 10));
    const skip = (page - 1) * limit;
    const where = {
        status: params.status ?? 'OPEN',
    };
    if (params.tradeType)
        where.tradeType = params.tradeType;
    if (params.state)
        where.state = { equals: params.state, mode: 'insensitive' };
    if (params.city)
        where.city = { equals: params.city, mode: 'insensitive' };
    if (params.minBudget)
        where.budgetMax = { gte: params.minBudget };
    if (params.maxBudget)
        where.budgetMin = { lte: params.maxBudget };
    if (params.search) {
        where.OR = [
            { title: { contains: params.search, mode: 'insensitive' } },
            { description: { contains: params.search, mode: 'insensitive' } },
        ];
    }
    const [jobs, total] = await Promise.all([
        prisma_1.default.job.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                investor: INVESTOR_SELECT,
                _count: { select: { bids: true } },
            },
        }),
        prisma_1.default.job.count({ where }),
    ]);
    return {
        jobs: jobs.map(({ _count, ...j }) => ({ ...j, bidCount: _count.bids })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}
async function getJobById(id, requesterId) {
    const job = await prisma_1.default.job.findUnique({
        where: { id },
        include: {
            investor: INVESTOR_SELECT,
            _count: { select: { bids: true } },
        },
    });
    if (!job)
        throw new app_error_1.AppError('Job not found', 404);
    let hasBid = false;
    if (requesterId) {
        const existing = await prisma_1.default.bid.findFirst({ where: { jobId: id, contractorId: requesterId } });
        hasBid = !!existing;
    }
    const { _count, ...rest } = job;
    return { ...rest, bidCount: _count.bids, hasBid };
}
async function updateJob(id, investorId, input) {
    const job = await prisma_1.default.job.findUnique({ where: { id } });
    if (!job)
        throw new app_error_1.AppError('Job not found', 404);
    if (job.investorId !== investorId)
        throw new app_error_1.AppError('Forbidden', 403);
    if (job.status !== 'OPEN')
        throw new app_error_1.AppError('Only open jobs can be edited', 400);
    // Validate budget constraint against persisted values when only one side changes
    const newMin = input.budgetMin ?? job.budgetMin;
    const newMax = input.budgetMax ?? job.budgetMax;
    if (newMin >= newMax)
        throw new app_error_1.AppError('budgetMin must be less than budgetMax', 400);
    return prisma_1.default.job.update({
        where: { id },
        data: input,
        include: { investor: INVESTOR_SELECT },
    });
}
async function cancelJob(id, investorId) {
    const job = await prisma_1.default.job.findUnique({ where: { id } });
    if (!job)
        throw new app_error_1.AppError('Job not found', 404);
    if (job.investorId !== investorId)
        throw new app_error_1.AppError('Forbidden', 403);
    if (job.status !== 'OPEN')
        throw new app_error_1.AppError('Only open jobs can be cancelled', 400);
    return prisma_1.default.job.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: { investor: INVESTOR_SELECT },
    });
}
async function getMyJobs(investorId) {
    const jobs = await prisma_1.default.job.findMany({
        where: { investorId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { bids: true } } },
    });
    return jobs.map(({ _count, ...j }) => ({ ...j, bidCount: _count.bids }));
}
// ── Bid services ─────────────────────────────────────────────────────────────
async function createBid(jobId, contractorId, input) {
    const job = await prisma_1.default.job.findUnique({ where: { id: jobId } });
    if (!job)
        throw new app_error_1.AppError('Job not found', 404);
    if (job.status !== 'OPEN')
        throw new app_error_1.AppError('Job is not open for bids', 400);
    const existing = await prisma_1.default.bid.findFirst({ where: { jobId, contractorId } });
    if (existing)
        throw new app_error_1.AppError('You have already bid on this job', 409);
    return prisma_1.default.bid.create({ data: { jobId, contractorId, ...input } });
}
async function getJobBids(jobId, requesterId, requesterRole) {
    const job = await prisma_1.default.job.findUnique({ where: { id: jobId } });
    if (!job)
        throw new app_error_1.AppError('Job not found', 404);
    if (job.investorId !== requesterId && requesterRole !== 'ADMIN') {
        throw new app_error_1.AppError('Forbidden', 403);
    }
    const bids = await prisma_1.default.bid.findMany({
        where: { jobId },
        orderBy: { createdAt: 'asc' },
    });
    // Enrich each bid with the contractor's profile (no schema relation needed)
    const contractorIds = [...new Set(bids.map((b) => b.contractorId))];
    const profiles = await prisma_1.default.contractorProfile.findMany({
        where: { userId: { in: contractorIds } },
        select: {
            userId: true,
            city: true,
            state: true,
            specialties: true,
            averageRating: true,
            totalReviews: true,
            yearsExperience: true,
            isAvailable: true,
            user: { select: { firstName: true, lastName: true } },
        },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    return bids.map((b) => ({ ...b, contractor: profileMap.get(b.contractorId) ?? null }));
}
async function getMyBid(jobId, contractorId) {
    const bid = await prisma_1.default.bid.findFirst({ where: { jobId, contractorId } });
    if (!bid)
        throw new app_error_1.AppError('Bid not found', 404);
    return bid;
}
async function acceptBid(jobId, bidId, investorId) {
    const job = await prisma_1.default.job.findUnique({ where: { id: jobId } });
    if (!job)
        throw new app_error_1.AppError('Job not found', 404);
    if (job.investorId !== investorId)
        throw new app_error_1.AppError('Forbidden', 403);
    if (job.status !== 'OPEN')
        throw new app_error_1.AppError('Job is not open', 400);
    const bid = await prisma_1.default.bid.findUnique({ where: { id: bidId } });
    if (!bid || bid.jobId !== jobId)
        throw new app_error_1.AppError('Bid not found', 404);
    const results = await prisma_1.default.$transaction([
        // Reject all other pending bids on this job
        prisma_1.default.bid.updateMany({
            where: { jobId, id: { not: bidId }, status: 'PENDING' },
            data: { status: 'REJECTED' },
        }),
        // Accept the chosen bid
        prisma_1.default.bid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } }),
        // Mark job as awarded
        prisma_1.default.job.update({ where: { id: jobId }, data: { status: 'AWARDED' } }),
    ]);
    return results[1]; // accepted Bid record
}
async function withdrawBid(jobId, bidId, contractorId) {
    const bid = await prisma_1.default.bid.findUnique({ where: { id: bidId } });
    if (!bid || bid.jobId !== jobId)
        throw new app_error_1.AppError('Bid not found', 404);
    if (bid.contractorId !== contractorId)
        throw new app_error_1.AppError('Forbidden', 403);
    if (bid.status !== 'PENDING')
        throw new app_error_1.AppError('Only pending bids can be withdrawn', 400);
    return prisma_1.default.bid.update({ where: { id: bidId }, data: { status: 'WITHDRAWN' } });
}
//# sourceMappingURL=job.service.js.map