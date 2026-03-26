import { Prisma, TradeType } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../utils/app-error';
import type { CreateJobInput, UpdateJobInput, CreateBidInput } from '../schemas/job.schemas';
import { classifyJob } from './ai.service';

// ── Selects ──────────────────────────────────────────────────────────────────

const INVESTOR_SELECT = { select: { firstName: true, lastName: true } } satisfies Prisma.UserDefaultArgs;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ListJobsParams {
  page?:      number;
  limit?:     number;
  tradeType?: string;
  state?:     string;
  city?:      string;
  minBudget?: number;
  maxBudget?: number;
  status?:    string;
  search?:    string;
}

// ── Job services ─────────────────────────────────────────────────────────────

export async function createJob(investorId: string, input: CreateJobInput) {
  // Run AI classification in background — never block job creation if it fails
  let aiSuggestedTradeType: TradeType | undefined;
  try {
    const suggested = await classifyJob(input.title, input.description);
    if (suggested !== input.tradeType) aiSuggestedTradeType = suggested;
  } catch {
    // Non-critical — continue without suggestion
  }

  return prisma.job.create({
    data:    { ...input, investorId, status: 'OPEN', aiSuggestedTradeType },
    include: { investor: INVESTOR_SELECT },
  });
}

export async function listJobs(params: ListJobsParams) {
  const page  = Math.max(1, params.page  ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 10));
  const skip  = (page - 1) * limit;

  const where: Prisma.JobWhereInput = {
    status: (params.status as Prisma.EnumJobStatusFilter | undefined) ?? 'OPEN',
  };

  if (params.tradeType) where.tradeType = params.tradeType as Prisma.EnumTradeTypeFilter;
  if (params.state)     where.state     = { equals: params.state, mode: 'insensitive' };
  if (params.city)      where.city      = { equals: params.city,  mode: 'insensitive' };
  if (params.minBudget) where.budgetMax = { gte: params.minBudget };
  if (params.maxBudget) where.budgetMin = { lte: params.maxBudget };
  if (params.search) {
    where.OR = [
      { title:       { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      skip,
      take:      limit,
      orderBy:   { createdAt: 'desc' },
      include: {
        investor: INVESTOR_SELECT,
        _count:   { select: { bids: true } },
      },
    }),
    prisma.job.count({ where }),
  ]);

  return {
    jobs: jobs.map(({ _count, ...j }) => ({ ...j, bidCount: _count.bids })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getJobById(id: string, requesterId?: string) {
  const job = await prisma.job.findUnique({
    where:   { id },
    include: {
      investor: INVESTOR_SELECT,
      _count:   { select: { bids: true } },
    },
  });
  if (!job) throw new AppError('Job not found', 404);

  let hasBid = false;
  if (requesterId) {
    const existing = await prisma.bid.findFirst({ where: { jobId: id, contractorId: requesterId } });
    hasBid = !!existing;
  }

  const { _count, ...rest } = job;
  return { ...rest, bidCount: _count.bids, hasBid };
}

export async function updateJob(id: string, investorId: string, input: UpdateJobInput) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job)                          throw new AppError('Job not found', 404);
  if (job.investorId !== investorId) throw new AppError('Forbidden', 403);
  if (job.status !== 'OPEN')         throw new AppError('Only open jobs can be edited', 400);

  // Validate budget constraint against persisted values when only one side changes
  const newMin = input.budgetMin ?? job.budgetMin;
  const newMax = input.budgetMax ?? job.budgetMax;
  if (newMin >= newMax) throw new AppError('budgetMin must be less than budgetMax', 400);

  return prisma.job.update({
    where:   { id },
    data:    input,
    include: { investor: INVESTOR_SELECT },
  });
}

export async function cancelJob(id: string, investorId: string) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job)                          throw new AppError('Job not found', 404);
  if (job.investorId !== investorId) throw new AppError('Forbidden', 403);
  if (job.status !== 'OPEN')         throw new AppError('Only open jobs can be cancelled', 400);

  return prisma.job.update({
    where:   { id },
    data:    { status: 'CANCELLED' },
    include: { investor: INVESTOR_SELECT },
  });
}

export async function getMyJobs(investorId: string) {
  const jobs = await prisma.job.findMany({
    where:   { investorId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { bids: true } } },
  });
  return jobs.map(({ _count, ...j }) => ({ ...j, bidCount: _count.bids }));
}

// ── Bid services ─────────────────────────────────────────────────────────────

export async function createBid(jobId: string, contractorId: string, input: CreateBidInput) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job)                  throw new AppError('Job not found', 404);
  if (job.status !== 'OPEN') throw new AppError('Job is not open for bids', 400);

  const existing = await prisma.bid.findFirst({ where: { jobId, contractorId } });
  if (existing) throw new AppError('You have already bid on this job', 409);

  return prisma.bid.create({ data: { jobId, contractorId, ...input } });
}

export async function getJobBids(jobId: string, requesterId: string, requesterRole: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Job not found', 404);

  if (job.investorId !== requesterId && requesterRole !== 'ADMIN') {
    throw new AppError('Forbidden', 403);
  }

  const bids = await prisma.bid.findMany({
    where:   { jobId },
    orderBy: { createdAt: 'asc' },
  });

  // Enrich each bid with the contractor's profile (no schema relation needed)
  const contractorIds = [...new Set(bids.map((b) => b.contractorId))];
  const profiles = await prisma.contractorProfile.findMany({
    where:  { userId: { in: contractorIds } },
    select: {
      userId:          true,
      city:            true,
      state:           true,
      specialties:     true,
      averageRating:   true,
      totalReviews:    true,
      yearsExperience: true,
      isAvailable:     true,
      user:            { select: { firstName: true, lastName: true } },
    },
  });
  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  return bids.map((b) => ({ ...b, contractor: profileMap.get(b.contractorId) ?? null }));
}

export async function getMyBid(jobId: string, contractorId: string) {
  const bid = await prisma.bid.findFirst({ where: { jobId, contractorId } });
  if (!bid) throw new AppError('Bid not found', 404);
  return bid;
}

export async function getMyBids(contractorId: string) {
  const bids = await prisma.bid.findMany({
    where:   { contractorId },
    orderBy: { createdAt: 'desc' },
  });

  const jobIds = [...new Set(bids.map((b) => b.jobId))];
  const jobs = await prisma.job.findMany({
    where:   { id: { in: jobIds } },
    include: { investor: { select: { firstName: true, lastName: true } } },
  });
  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  return bids.map((b) => ({ ...b, job: jobMap.get(b.jobId) ?? null }));
}

export async function acceptBid(jobId: string, bidId: string, investorId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job)                          throw new AppError('Job not found', 404);
  if (job.investorId !== investorId) throw new AppError('Forbidden', 403);
  if (job.status !== 'OPEN')         throw new AppError('Job is not open', 400);

  const bid = await prisma.bid.findUnique({ where: { id: bidId } });
  if (!bid || bid.jobId !== jobId)   throw new AppError('Bid not found', 404);

  const results = await prisma.$transaction([
    // Reject all other pending bids on this job
    prisma.bid.updateMany({
      where: { jobId, id: { not: bidId }, status: 'PENDING' },
      data:  { status: 'REJECTED' },
    }),
    // Accept the chosen bid
    prisma.bid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } }),
    // Mark job as awarded
    prisma.job.update({ where: { id: jobId }, data: { status: 'AWARDED' } }),
  ]);

  return results[1]; // accepted Bid record
}

export async function withdrawBid(jobId: string, bidId: string, contractorId: string) {
  const bid = await prisma.bid.findUnique({ where: { id: bidId } });
  if (!bid || bid.jobId !== jobId)       throw new AppError('Bid not found', 404);
  if (bid.contractorId !== contractorId) throw new AppError('Forbidden', 403);
  if (bid.status !== 'PENDING')          throw new AppError('Only pending bids can be withdrawn', 400);

  return prisma.bid.update({ where: { id: bidId }, data: { status: 'WITHDRAWN' } });
}
