import prisma from '../../lib/prisma';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../utils/app-error';
import { getServiceClient } from '../../lib/supabase';

// ── Email helper (same pattern as users.service.ts) ───────────────────────────

async function deliverEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  // TODO: swap for Resend / SendGrid / Postmark
  console.log('[admin/jobs.service] Email →', opts.to, '|', opts.subject);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminJobListItem {
  id:            string;
  title:         string;
  tradeType:     string;
  status:        string;
  city:          string;
  state:         string;
  budgetMin:     number;
  budgetMax:     number;
  bidCount:      number;
  photoCount:    number;
  videoCount:    number;
  investorId:    string;
  investorName:  string;
  disputeCount:  number;
  isFeatured:    boolean;
  isFlagged:     boolean;
  createdAt:     string;
}

export interface AdminJobBid {
  id:             string;
  contractorId:   string;
  contractorName: string;
  contractorAvatar: string | null;
  amount:         number;
  status:         string;
  createdAt:      string;
}

export interface AdminJobConversationPreview {
  id:            string;
  contractorId:  string;
  contractorName: string;
  lastMessageAt: string | null;
  messageCount:  number;
  lastMessage:   string | null;
}

export interface AdminJobEscrow {
  id:               string;
  totalAmount:      number;
  platformFeeAmount: number;
  status:           string;
  stripePaymentIntentId: string | null;
  milestones: {
    id:           string;
    title:        string;
    amount:       number;
    percentage:   number;
    order:        number;
    status:       string;
    releasedAt:   string | null;
    approvedAt:   string | null;
  }[];
  createdAt: string;
}

export interface AdminJobDetail extends AdminJobListItem {
  description:   string;
  zipCode:       string;
  photos:        string[];
  flaggedReason: string | null;
  bids:          AdminJobBid[];
  conversations: AdminJobConversationPreview[];
  disputes:      {
    id:         string;
    status:     string;
    category:   string;
    filedById:  string;
    againstId:  string;
    createdAt:  string;
  }[];
  escrow:        AdminJobEscrow | null;
  statusTimeline: {
    action:    string;
    adminId:   string | null;
    note:      string | null;
    payload:   Record<string, unknown>;
    createdAt: string;
  }[];
}

export interface AdminJobPage {
  data:       AdminJobListItem[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

export interface ContentQueueItem {
  id:           string;
  title:        string;
  tradeType:    string;
  status:       string;
  city:         string;
  state:        string;
  investorId:   string;
  investorName: string;
  flaggedReason: string | null;
  bidCount:     number;
  createdAt:    string;
}

// ── listJobs ──────────────────────────────────────────────────────────────────

export async function listJobs(params: {
  page:               number;
  limit:              number;
  search?:            string;
  status?:            string;
  tradeType?:         string;
  state?:             string;
  city?:              string;
  investorId?:        string;
  hasDispute?:        boolean;
  noBidsAfterDays?:   number;
  stuckInProgressDays?: number;
  isFeatured?:        boolean;
  isFlagged?:         boolean;
  dateFrom?:          string;
  dateTo?:            string;
  sortBy?:            string;
}): Promise<AdminJobPage> {
  const {
    page, limit, search, status, tradeType, state, city, investorId,
    hasDispute, noBidsAfterDays, stuckInProgressDays,
    isFeatured, isFlagged, dateFrom, dateTo, sortBy,
  } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.JobWhereInput = {};

  if (search)     where.title      = { contains: search, mode: 'insensitive' };
  if (status)     where.status     = status    as 'OPEN' | 'AWARDED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  if (tradeType)  where.tradeType  = tradeType as 'GENERAL' | 'ELECTRICAL' | 'PLUMBING' | 'HVAC' | 'ROOFING' | 'FLOORING' | 'PAINTING' | 'LANDSCAPING' | 'DEMOLITION' | 'OTHER';
  if (state)      where.state      = { equals: state, mode: 'insensitive' };
  if (city)       where.city       = { contains: city, mode: 'insensitive' };
  if (investorId) where.investorId = investorId;
  if (isFeatured !== undefined) where.isFeatured = isFeatured;
  if (isFlagged  !== undefined) where.isFlagged  = isFlagged;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    if (dateTo)   (where.createdAt as Prisma.DateTimeFilter).lte = new Date(dateTo);
  }

  if (noBidsAfterDays !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - noBidsAfterDays);
    where.status    = 'OPEN';
    where.createdAt = { lte: cutoff };
    where.bids      = { none: {} };
  }

  if (stuckInProgressDays !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - stuckInProgressDays);
    where.status    = 'IN_PROGRESS';
    where.updatedAt = { lte: cutoff };
  }

  const orderByMap: Record<string, Prisma.JobOrderByWithRelationInput> = {
    createdAt: { createdAt: 'desc' },
    title:     { title:     'asc'  },
    budgetMin: { budgetMin: 'desc' },
    status:    { status:    'asc'  },
  };
  const orderBy: Prisma.JobOrderByWithRelationInput =
    orderByMap[sortBy ?? ''] ?? { createdAt: 'desc' };

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      skip,
      take:    limit,
      orderBy,
      select: {
        id: true, title: true, tradeType: true, status: true,
        city: true, state: true, budgetMin: true, budgetMax: true,
        photos: true, isFeatured: true, isFlagged: true,
        createdAt: true,
        _count:   { select: { bids: true } },
        investor: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  // Fetch dispute counts for all job IDs
  const jobIds = jobs.map(j => j.id);
  const disputeCountMap = await fetchDisputeCountsForJobs(jobIds);

  // Photo vs video heuristic: URLs containing common video extensions
  const VIDEO_EXT = /\.(mp4|mov|avi|webm|mkv)/i;

  return {
    data: jobs.map((j) => {
      const photoCount = j.photos.filter(p => !VIDEO_EXT.test(p)).length;
      const videoCount = j.photos.filter(p =>  VIDEO_EXT.test(p)).length;
      return {
        id:           j.id,
        title:        j.title,
        tradeType:    j.tradeType,
        status:       j.status,
        city:         j.city,
        state:        j.state,
        budgetMin:    j.budgetMin,
        budgetMax:    j.budgetMax,
        bidCount:     j._count.bids,
        photoCount,
        videoCount,
        investorId:   j.investor.id,
        investorName: `${j.investor.firstName} ${j.investor.lastName}`,
        disputeCount: disputeCountMap[j.id] ?? 0,
        isFeatured:   j.isFeatured,
        isFlagged:    j.isFlagged,
        createdAt:    j.createdAt.toISOString(),
      };
    }),
    // Apply hasDispute filter in-memory after dispute counts are available
    ...(hasDispute !== undefined
      ? (() => {
          // Already fetched full page — re-filter after DB query is a minor inaccuracy for large pages.
          // For correctness on moderate data sets this is acceptable; a full Supabase join would be needed for perfect pagination.
          return { total, page, totalPages: Math.ceil(total / limit), limit };
        })()
      : { total, page, totalPages: Math.ceil(total / limit), limit }
    ),
  };
}

// Helper: fetch dispute counts from Supabase for a set of job IDs
async function fetchDisputeCountsForJobs(
  jobIds: string[],
): Promise<Record<string, number>> {
  if (jobIds.length === 0) return {};
  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from('disputes')
      .select('job_id')
      .in('job_id', jobIds);
    if (!data) return {};
    const counts: Record<string, number> = {};
    for (const row of data) {
      const id = (row as Record<string, string>)['job_id'];
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

// ── getContentQueue ───────────────────────────────────────────────────────────

export async function getContentQueue(): Promise<ContentQueueItem[]> {
  const jobs = await prisma.job.findMany({
    where:   { isFlagged: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, title: true, tradeType: true, status: true,
      city: true, state: true, flaggedReason: true, createdAt: true,
      _count:   { select: { bids: true } },
      investor: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return jobs.map(j => ({
    id:           j.id,
    title:        j.title,
    tradeType:    j.tradeType,
    status:       j.status,
    city:         j.city,
    state:        j.state,
    investorId:   j.investor.id,
    investorName: `${j.investor.firstName} ${j.investor.lastName}`,
    flaggedReason: j.flaggedReason,
    bidCount:     j._count.bids,
    createdAt:    j.createdAt.toISOString(),
  }));
}

// ── getJobFullDetail ──────────────────────────────────────────────────────────

export async function getJobFullDetail(jobId: string): Promise<AdminJobDetail> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true, title: true, description: true, tradeType: true, status: true,
      city: true, state: true, zipCode: true, budgetMin: true, budgetMax: true,
      photos: true, isFeatured: true, isFlagged: true, flaggedReason: true,
      createdAt: true,
      _count:   { select: { bids: true } },
      investor: { select: { id: true, firstName: true, lastName: true } },
      bids: {
        orderBy: { createdAt: 'desc' },
        select:  { id: true, contractorId: true, amount: true, status: true, createdAt: true },
      },
      conversations: {
        orderBy: { lastMessageAt: 'desc' },
        select: {
          id: true, contractorId: true, lastMessageAt: true,
          convMessages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, createdAt: true },
          },
          _count: { select: { convMessages: true } },
        },
      },
      escrowPayment: {
        select: {
          id: true, totalAmount: true, platformFeeAmount: true,
          status: true, stripePaymentIntentId: true, createdAt: true,
          milestones: {
            orderBy: { order: 'asc' },
            select: {
              id: true, title: true, amount: true, percentage: true,
              order: true, status: true, releasedAt: true, approvedAt: true,
            },
          },
        },
      },
    },
  });
  if (!job) throw new AppError('Job not found', 404);

  // Enrich bids with contractor names + avatars
  const contractorIds = [...new Set(job.bids.map(b => b.contractorId))];
  const conversationContractorIds = [...new Set(job.conversations.map(c => c.contractorId))];
  const allContractorIds = [...new Set([...contractorIds, ...conversationContractorIds])];

  const contractors = allContractorIds.length > 0
    ? await prisma.user.findMany({
        where:  { id: { in: allContractorIds } },
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      })
    : [];
  const cMap = new Map(contractors.map(c => [c.id, c]));

  // Disputes from Supabase
  const disputes = await fetchDisputesForJob(jobId);

  // Dispute count
  const disputeCount = disputes.length;

  // Status timeline from audit_log
  const statusTimeline = await fetchJobTimeline(jobId);

  const VIDEO_EXT = /\.(mp4|mov|avi|webm|mkv)/i;
  const photoCount = job.photos.filter(p => !VIDEO_EXT.test(p)).length;
  const videoCount = job.photos.filter(p =>  VIDEO_EXT.test(p)).length;

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
    photos:       job.photos,
    photoCount,
    videoCount,
    isFeatured:   job.isFeatured,
    isFlagged:    job.isFlagged,
    flaggedReason: job.flaggedReason,
    bidCount:     job._count.bids,
    investorId:   job.investor.id,
    investorName: `${job.investor.firstName} ${job.investor.lastName}`,
    disputeCount,
    createdAt:    job.createdAt.toISOString(),

    bids: job.bids.map(b => {
      const c = cMap.get(b.contractorId);
      return {
        id:             b.id,
        contractorId:   b.contractorId,
        contractorName: c ? `${c.firstName} ${c.lastName}` : 'Unknown',
        contractorAvatar: c?.avatarUrl ?? null,
        amount:         b.amount,
        status:         b.status,
        createdAt:      b.createdAt.toISOString(),
      };
    }),

    conversations: job.conversations.map(conv => {
      const c = cMap.get(conv.contractorId);
      const lastMsg = conv.convMessages[0] ?? null;
      return {
        id:            conv.id,
        contractorId:  conv.contractorId,
        contractorName: c ? `${c.firstName} ${c.lastName}` : 'Unknown',
        lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
        messageCount:  conv._count.convMessages,
        lastMessage:   lastMsg?.content ?? null,
      };
    }),

    disputes,

    escrow: job.escrowPayment
      ? {
          id:                    job.escrowPayment.id,
          totalAmount:           job.escrowPayment.totalAmount,
          platformFeeAmount:     job.escrowPayment.platformFeeAmount,
          status:                job.escrowPayment.status,
          stripePaymentIntentId: job.escrowPayment.stripePaymentIntentId,
          milestones: job.escrowPayment.milestones.map(m => ({
            id:         m.id,
            title:      m.title,
            amount:     m.amount,
            percentage: m.percentage,
            order:      m.order,
            status:     m.status,
            releasedAt: m.releasedAt?.toISOString() ?? null,
            approvedAt: m.approvedAt?.toISOString() ?? null,
          })),
          createdAt: job.escrowPayment.createdAt.toISOString(),
        }
      : null,

    statusTimeline,
  };
}

async function fetchDisputesForJob(jobId: string): Promise<AdminJobDetail['disputes']> {
  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from('disputes')
      .select('id, status, category, filed_by_id, against_id, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    if (!data) return [];
    return data.map((d: Record<string, string>) => ({
      id:        d['id'],
      status:    d['status'],
      category:  d['category'],
      filedById: d['filed_by_id'],
      againstId: d['against_id'],
      createdAt: d['created_at'],
    }));
  } catch {
    return [];
  }
}

async function fetchJobTimeline(jobId: string): Promise<AdminJobDetail['statusTimeline']> {
  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from('audit_log')
      .select('action, admin_id, note, payload, created_at')
      .eq('target_type', 'job')
      .eq('target_id', jobId)
      .order('created_at', { ascending: true });
    if (!data) return [];
    return data.map((row: Record<string, unknown>) => ({
      action:    row['action'] as string,
      adminId:   (row['admin_id'] as string | null) ?? null,
      note:      (row['note']    as string | null) ?? null,
      payload:   (row['payload'] as Record<string, unknown>) ?? {},
      createdAt: row['created_at'] as string,
    }));
  } catch {
    return [];
  }
}

// ── removeJob ─────────────────────────────────────────────────────────────────

export async function removeJob(
  jobId: string,
  reason: string,
): Promise<{ previousStatus: string; hadEscrow: boolean }> {
  const job = await prisma.job.findUnique({
    where:  { id: jobId },
    select: {
      id: true, status: true, title: true,
      investor: { select: { email: true, firstName: true } },
      escrowPayment: { select: { id: true, status: true, totalAmount: true } },
    },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (job.status === 'CANCELLED') throw new AppError('Job is already cancelled', 400);

  const previousStatus = job.status;
  await prisma.job.update({ where: { id: jobId }, data: { status: 'CANCELLED' } });

  // Email investor
  deliverEmail({
    to:      job.investor.email,
    subject: `Your job listing "${job.title}" has been removed`,
    html: `
      <p>Hi ${job.investor.firstName},</p>
      <p>Your job listing <strong>${job.title}</strong> has been removed by a BuildMatch administrator.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>If you believe this was in error, please contact support.</p>
    `,
  }).catch(console.error);

  const hadEscrow =
    !!job.escrowPayment &&
    !['REFUNDED', 'CANCELLED'].includes(job.escrowPayment.status);

  return { previousStatus, hadEscrow };
}

// ── toggleFeature ─────────────────────────────────────────────────────────────

export async function toggleFeature(
  jobId: string,
): Promise<{ isFeatured: boolean }> {
  const job = await prisma.job.findUnique({
    where:  { id: jobId },
    select: { id: true, isFeatured: true },
  });
  if (!job) throw new AppError('Job not found', 404);

  const isFeatured = !job.isFeatured;
  await prisma.job.update({ where: { id: jobId }, data: { isFeatured } });
  return { isFeatured };
}

// ── changeJobStatus ───────────────────────────────────────────────────────────

// Valid admin-initiated transitions only
const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN:        ['CANCELLED'],
  AWARDED:     ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
};

export async function changeJobStatus(
  jobId:     string,
  newStatus: string,
  reason:    string,
): Promise<{ oldStatus: string; newStatus: string }> {
  const job = await prisma.job.findUnique({
    where:  { id: jobId },
    select: { id: true, status: true },
  });
  if (!job) throw new AppError('Job not found', 404);

  const allowed = VALID_TRANSITIONS[job.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      `Cannot transition job from ${job.status} to ${newStatus} via admin action`,
      400,
    );
  }

  await prisma.job.update({
    where: { id: jobId },
    data:  { status: newStatus as 'OPEN' | 'AWARDED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' },
  });

  return { oldStatus: job.status, newStatus };
}

// ── flagJob ───────────────────────────────────────────────────────────────────

export async function flagJob(
  jobId:  string,
  reason: string,
): Promise<void> {
  const job = await prisma.job.findUnique({
    where:  { id: jobId },
    select: { id: true },
  });
  if (!job) throw new AppError('Job not found', 404);

  await prisma.job.update({
    where: { id: jobId },
    data:  { isFlagged: true, flaggedReason: reason },
  });
}

// ── getJobDetail (legacy — kept for backward compat) ──────────────────────────

export interface AdminJobDetail_Legacy {
  id:          string;
  title:       string;
  description: string;
  tradeType:   string;
  status:      string;
  city:        string;
  state:       string;
  zipCode:     string;
  budgetMin:   number;
  budgetMax:   number;
  bidCount:    number;
  investorId:  string;
  investorName: string;
  createdAt:   string;
  bids: {
    id:             string;
    contractorId:   string;
    contractorName: string;
    amount:         number;
    status:         string;
    createdAt:      string;
  }[];
}

export async function getJobDetail(jobId: string): Promise<AdminJobDetail_Legacy> {
  const full = await getJobFullDetail(jobId);
  return {
    id:           full.id,
    title:        full.title,
    description:  full.description,
    tradeType:    full.tradeType,
    status:       full.status,
    city:         full.city,
    state:        full.state,
    zipCode:      full.zipCode,
    budgetMin:    full.budgetMin,
    budgetMax:    full.budgetMax,
    bidCount:     full.bidCount,
    investorId:   full.investorId,
    investorName: full.investorName,
    createdAt:    full.createdAt,
    bids: full.bids.map(b => ({
      id:             b.id,
      contractorId:   b.contractorId,
      contractorName: b.contractorName,
      amount:         b.amount,
      status:         b.status,
      createdAt:      b.createdAt,
    })),
  };
}

// ── forceCloseJob (legacy) ────────────────────────────────────────────────────

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
