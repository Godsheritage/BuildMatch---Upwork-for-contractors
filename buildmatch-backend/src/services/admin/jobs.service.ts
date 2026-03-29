import prisma from '../../lib/prisma';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../utils/app-error';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminJobListItem {
  id:          string;
  title:       string;
  tradeType:   string;
  status:      string;
  city:        string;
  state:       string;
  budgetMin:   number;
  budgetMax:   number;
  bidCount:    number;
  investorId:  string;
  investorName: string;
  createdAt:   string;
}

export interface AdminJobDetail extends AdminJobListItem {
  description: string;
  zipCode:     string;
  bids: {
    id:             string;
    contractorId:   string;
    contractorName: string;
    amount:         number;
    status:         string;
    createdAt:      string;
  }[];
}

export interface AdminJobPage {
  data:       AdminJobListItem[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

// ── listJobs ──────────────────────────────────────────────────────────────────

export async function listJobs(params: {
  page:       number;
  limit:      number;
  search?:    string;
  status?:    string;
  tradeType?: string;
}): Promise<AdminJobPage> {
  const { page, limit, search, status, tradeType } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.JobWhereInput = {};

  if (search)    where.title     = { contains: search, mode: 'insensitive' };
  if (status)    where.status    = status    as 'OPEN' | 'AWARDED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  if (tradeType) where.tradeType = tradeType as 'GENERAL' | 'ELECTRICAL' | 'PLUMBING' | 'HVAC' | 'ROOFING' | 'FLOORING' | 'PAINTING' | 'LANDSCAPING' | 'DEMOLITION' | 'OTHER';

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, tradeType: true, status: true,
        city: true, state: true, budgetMin: true, budgetMax: true,
        createdAt: true,
        _count:   { select: { bids: true } },
        investor: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  return {
    data: jobs.map((j) => ({
      id:           j.id,
      title:        j.title,
      tradeType:    j.tradeType,
      status:       j.status,
      city:         j.city,
      state:        j.state,
      budgetMin:    j.budgetMin,
      budgetMax:    j.budgetMax,
      bidCount:     j._count.bids,
      investorId:   j.investor.id,
      investorName: `${j.investor.firstName} ${j.investor.lastName}`,
      createdAt:    j.createdAt.toISOString(),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
}

// ── getJobDetail ──────────────────────────────────────────────────────────────

export async function getJobDetail(jobId: string): Promise<AdminJobDetail> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true, title: true, description: true, tradeType: true, status: true,
      city: true, state: true, zipCode: true, budgetMin: true, budgetMax: true,
      createdAt: true,
      _count:   { select: { bids: true } },
      investor: { select: { id: true, firstName: true, lastName: true } },
      bids: {
        orderBy: { createdAt: 'desc' },
        select:  { id: true, contractorId: true, amount: true, status: true, createdAt: true },
      },
    },
  });
  if (!job) throw new AppError('Job not found', 404);

  // Enrich bids with contractor names
  const contractorIds = [...new Set(job.bids.map(b => b.contractorId))];
  const contractors   = contractorIds.length > 0
    ? await prisma.user.findMany({
        where:  { id: { in: contractorIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const cMap = new Map(contractors.map(c => [c.id, `${c.firstName} ${c.lastName}`]));

  return {
    id:           job.id,
    title:        job.title,
    description:  job.description,
    tradeType:    job.tradeType,
    status:       job.status,
    city:         job.city,
    state:        job.state,
    zipCode:      job.zipCode,
    budgetMin:    job.budgetMin,
    budgetMax:    job.budgetMax,
    bidCount:     job._count.bids,
    investorId:   job.investor.id,
    investorName: `${job.investor.firstName} ${job.investor.lastName}`,
    createdAt:    job.createdAt.toISOString(),
    bids: job.bids.map(b => ({
      id:             b.id,
      contractorId:   b.contractorId,
      contractorName: cMap.get(b.contractorId) ?? 'Unknown',
      amount:         b.amount,
      status:         b.status,
      createdAt:      b.createdAt.toISOString(),
    })),
  };
}

// ── forceCloseJob ─────────────────────────────────────────────────────────────

export async function forceCloseJob(jobId: string): Promise<{ previousStatus: string }> {
  const job = await prisma.job.findUnique({
    where:  { id: jobId },
    select: { id: true, status: true },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (job.status === 'CANCELLED') throw new AppError('Job is already cancelled', 400);
  if (job.status === 'COMPLETED') throw new AppError('Completed jobs cannot be force-closed', 400);

  const previousStatus = job.status;
  await prisma.job.update({ where: { id: jobId }, data: { status: 'CANCELLED' } });

  return { previousStatus };
}
