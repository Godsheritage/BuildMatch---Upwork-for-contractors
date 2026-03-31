/**
 * src/services/admin/finance.service.ts
 *
 * Finance data is derived from EscrowPayment + Milestone records (Prisma)
 * and Stripe API calls. There is no separate "transactions" table; this
 * service builds a virtual transaction ledger from the two Prisma models.
 *
 * Transaction types:
 *   escrow_deposit  — investor funds the job (EscrowPayment)
 *   milestone_release — approved milestone transfer to contractor (Milestone)
 *   fee             — platform fee slice of an escrow deposit
 *   refund          — stripe refund issued against the PaymentIntent
 *   payout          — alias for milestone_release (contractor receives money)
 */

import prisma from '../../lib/prisma';
import type { Prisma, PaymentStatus } from '@prisma/client';
import { stripe } from '../stripe.service';
import { AppError } from '../../utils/app-error';

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthRange(offset = 0): { gte: Date; lt: Date } {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + offset; // JS months are 0-indexed; offset -1 = last month
  const gte   = new Date(year, month, 1);
  const lt    = new Date(year, month + 1, 1);
  return { gte, lt };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type TransactionType =
  | 'escrow_deposit'
  | 'milestone_release'
  | 'fee'
  | 'refund'
  | 'payout';

export interface FinanceSummary {
  totalGmvAllTime:         number;
  totalGmvThisMonth:       number;
  totalGmvLastMonth:       number;
  totalRevenueAllTime:     number;
  totalRevenueThisMonth:   number;
  totalRevenueLastMonth:   number;
  fundsCurrentlyInEscrow:  number;
  avgJobValue:             number;
  totalTransactions:       number;
  failedTransactions:      number;
  pendingPayouts:          number;
  failedPayouts:           number;
}

export interface FinanceTransaction {
  id:             string;
  jobId:          string;
  jobTitle:       string;
  investorName:   string;
  contractorName: string;
  type:           TransactionType;
  amount:         number;
  platformFee:    number;
  netAmount:      number;
  status:         string;
  stripeId:       string | null;
  createdAt:      string;
}

export interface FinanceTransactionPage {
  data:       FinanceTransaction[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

export interface FinancePayout {
  id:              string;
  contractorId:    string;
  contractorName:  string;
  jobId:           string;
  jobTitle:        string;
  amount:          number;
  stripePayoutId:  string | null;
  status:          string;
  createdAt:       string;
}

export interface FailedItem {
  id:          string;
  type:        'failed_deposit' | 'failed_payout';
  jobId:       string | null;
  jobTitle:    string | null;
  partyName:   string;
  amount:      number;
  stripeId:    string | null;
  status:      string;
  createdAt:   string;
}

// ── Statuses that represent real funded activity (exclude PENDING/CANCELLED) ──

const ACTIVE_STATUSES: PaymentStatus[] = ['FUNDED', 'IN_PROGRESS', 'RELEASED', 'FULLY_RELEASED', 'DISPUTED', 'REFUNDED'];
const ESCROW_STATUSES: PaymentStatus[] = ['FUNDED', 'IN_PROGRESS', 'DISPUTED'];

// ── getFinanceSummary ─────────────────────────────────────────────────────────

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);

  const [
    gmvAll,
    gmvThis,
    gmvLast,
    revenueAll,
    revenueThis,
    revenueLast,
    escrowFunds,
    transactionCount,
    cancelledCount,
    pendingMilestones,
  ] = await Promise.all([
    // GMV: sum of totalAmount for non-pending, non-cancelled escrows
    prisma.escrowPayment.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ACTIVE_STATUSES } },
    }),
    prisma.escrowPayment.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ACTIVE_STATUSES }, createdAt: thisMonth },
    }),
    prisma.escrowPayment.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ACTIVE_STATUSES }, createdAt: lastMonth },
    }),

    // Revenue: sum of platformFeeAmount for funded escrows
    prisma.escrowPayment.aggregate({
      _sum: { platformFeeAmount: true },
      where: { status: { in: ACTIVE_STATUSES } },
    }),
    prisma.escrowPayment.aggregate({
      _sum: { platformFeeAmount: true },
      where: { status: { in: ACTIVE_STATUSES }, createdAt: thisMonth },
    }),
    prisma.escrowPayment.aggregate({
      _sum: { platformFeeAmount: true },
      where: { status: { in: ACTIVE_STATUSES }, createdAt: lastMonth },
    }),

    // Funds currently locked in escrow
    prisma.escrowPayment.aggregate({
      _sum: { totalAmount: true },
      where: { status: { in: ESCROW_STATUSES } },
    }),

    // Total transactions (funded+ only)
    prisma.escrowPayment.count({
      where: { status: { in: ACTIVE_STATUSES } },
    }),

    // "Failed" deposits = CANCELLED escrows that had a Stripe intent (payment attempted)
    prisma.escrowPayment.count({
      where: {
        status: 'CANCELLED',
        stripePaymentIntentId: { not: null },
      },
    }),

    // Pending payouts = milestone amounts with APPROVED status (transfer sent but webhook not yet received)
    prisma.milestone.aggregate({
      _sum:  { amount: true },
      _count: { id: true },
      where: { status: 'APPROVED' },
    }),
  ]);

  const totalGmvAllTime   = gmvAll._sum?.totalAmount     ?? 0;
  const totalTransactions = transactionCount;
  const avgJobValue       = totalTransactions > 0 ? totalGmvAllTime / totalTransactions : 0;

  return {
    totalGmvAllTime,
    totalGmvThisMonth:       gmvThis._sum?.totalAmount      ?? 0,
    totalGmvLastMonth:       gmvLast._sum?.totalAmount      ?? 0,
    totalRevenueAllTime:     revenueAll._sum?.platformFeeAmount  ?? 0,
    totalRevenueThisMonth:   revenueThis._sum?.platformFeeAmount ?? 0,
    totalRevenueLastMonth:   revenueLast._sum?.platformFeeAmount ?? 0,
    fundsCurrentlyInEscrow:  escrowFunds._sum?.totalAmount   ?? 0,
    avgJobValue,
    totalTransactions,
    failedTransactions:      cancelledCount,
    pendingPayouts:          pendingMilestones._sum?.amount  ?? 0,
    // Failed payouts require Stripe webhook tracking; not stored in DB currently
    failedPayouts:           0,
  };
}

// ── getTransactions ───────────────────────────────────────────────────────────

export async function getTransactions(params: {
  page:        number;
  limit:       number;
  type?:       TransactionType;
  status?:     string;
  dateFrom?:   string;
  dateTo?:     string;
  investorId?: string;
}): Promise<FinanceTransactionPage> {
  const { page, limit, type, status, dateFrom, dateTo, investorId } = params;
  const skip = (page - 1) * limit;

  // ── Milestone-based types ─────────────────────────────────────────────────

  if (type === 'milestone_release' || type === 'payout') {
    const msWhere: Prisma.MilestoneWhereInput = {};
    if (status) msWhere.status = status as 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'DISPUTED' | 'RELEASED';
    if (dateFrom || dateTo) {
      msWhere.approvedAt = {};
      if (dateFrom) (msWhere.approvedAt as Prisma.DateTimeNullableFilter).gte = new Date(dateFrom);
      if (dateTo)   (msWhere.approvedAt as Prisma.DateTimeNullableFilter).lte = new Date(dateTo);
    }
    if (type === 'payout') msWhere.stripeTransferId = { not: null };

    const [total, milestones] = await Promise.all([
      prisma.milestone.count({ where: msWhere }),
      prisma.milestone.findMany({
        where: msWhere,
        skip,
        take: limit,
        orderBy: { approvedAt: 'desc' },
        select: {
          id: true, amount: true, status: true, stripeTransferId: true, approvedAt: true, title: true,
          escrowPayment: {
            select: {
              jobId: true, investorId: true, contractorId: true,
              job: { select: { title: true } },
            },
          },
        },
      }),
    ]);

    // Batch-fetch contractor + investor names
    const userIds = milestones.flatMap(m => [m.escrowPayment.investorId, m.escrowPayment.contractorId]);
    const users   = await prisma.user.findMany({
      where:  { id: { in: [...new Set(userIds)] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const uMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    const data: FinanceTransaction[] = milestones.map(m => ({
      id:             m.id,
      jobId:          m.escrowPayment.jobId,
      jobTitle:       m.escrowPayment.job.title,
      investorName:   uMap.get(m.escrowPayment.investorId) ?? 'Unknown',
      contractorName: uMap.get(m.escrowPayment.contractorId) ?? 'Unknown',
      type:           type,
      amount:         m.amount,
      platformFee:    0,
      netAmount:      m.amount,
      status:         m.status,
      stripeId:       m.stripeTransferId,
      createdAt:      (m.approvedAt ?? new Date()).toISOString(),
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit), limit };
  }

  // ── EscrowPayment-based types (default, fee, refund, escrow_deposit) ───────

  const epWhere: Prisma.EscrowPaymentWhereInput = {};

  if (investorId) epWhere.investorId = investorId;

  if (type === 'refund') {
    epWhere.status = 'REFUNDED';
  } else if (type === 'fee' || type === 'escrow_deposit') {
    // no extra status filter beyond the user-supplied one
    if (status) epWhere.status = status as 'PENDING' | 'FUNDED' | 'IN_PROGRESS' | 'RELEASED' | 'FULLY_RELEASED' | 'DISPUTED' | 'REFUNDED' | 'CANCELLED';
  } else {
    // No type or unrecognised type — return all EscrowPayment rows
    if (status) epWhere.status = status as 'PENDING' | 'FUNDED' | 'IN_PROGRESS' | 'RELEASED' | 'FULLY_RELEASED' | 'DISPUTED' | 'REFUNDED' | 'CANCELLED';
  }

  if (dateFrom || dateTo) {
    epWhere.createdAt = {};
    if (dateFrom) (epWhere.createdAt as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    if (dateTo)   (epWhere.createdAt as Prisma.DateTimeFilter).lte = new Date(dateTo);
  }

  const [total, escrows] = await Promise.all([
    prisma.escrowPayment.count({ where: epWhere }),
    prisma.escrowPayment.findMany({
      where: epWhere,
      skip,
      take:  limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, investorId: true, contractorId: true,
        totalAmount: true, platformFeeAmount: true,
        status: true, stripePaymentIntentId: true, createdAt: true,
        job: { select: { id: true, title: true } },
      },
    }),
  ]);

  // Batch user name lookup
  const userIds = escrows.flatMap(e => [e.investorId, e.contractorId]);
  const users   = await prisma.user.findMany({
    where:  { id: { in: [...new Set(userIds)] } },
    select: { id: true, firstName: true, lastName: true },
  });
  const uMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

  const resolvedType = (type === 'fee' || type === 'refund' || type === 'escrow_deposit')
    ? type
    : 'escrow_deposit';

  const data: FinanceTransaction[] = escrows.map(e => {
    const amount     = resolvedType === 'fee' ? e.platformFeeAmount : e.totalAmount;
    const platFee    = resolvedType === 'fee' ? 0 : e.platformFeeAmount;
    const netAmount  = amount - platFee;
    return {
      id:             e.id,
      jobId:          e.job.id,
      jobTitle:       e.job.title,
      investorName:   uMap.get(e.investorId)    ?? 'Unknown',
      contractorName: uMap.get(e.contractorId)  ?? 'Unknown',
      type:           resolvedType as TransactionType,
      amount,
      platformFee:    platFee,
      netAmount,
      status:         e.status,
      stripeId:       e.stripePaymentIntentId,
      createdAt:      e.createdAt.toISOString(),
    };
  });

  return { data, total, page, totalPages: Math.ceil(total / limit), limit };
}

// ── getPayouts ────────────────────────────────────────────────────────────────
// Payouts = milestone transfers that have been sent to contractors.
// A milestone with stripeTransferId set = a payout was issued.

export async function getPayouts(params: {
  status?:       string;
  contractorId?: string;
}): Promise<FinancePayout[]> {
  const { status, contractorId } = params;

  const where: Prisma.MilestoneWhereInput = {};

  // Map external status param to Milestone statuses
  if (status === 'processed') {
    where.status          = 'RELEASED';
  } else if (status === 'pending') {
    where.status          = 'APPROVED';   // transfer sent, webhook not yet confirmed
    where.stripeTransferId = { not: null };
  } else if (status === 'failed') {
    // No explicit failed status in DB — milestones APPROVED with no release after >24h would be stale,
    // but we can't reliably detect this without Stripe API calls. Return empty for now.
    return [];
  } else if (status) {
    // Pass through any other status values
    where.status = status as 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'DISPUTED' | 'RELEASED';
  } else {
    // Default: all milestones with a transfer ID
    where.stripeTransferId = { not: null };
  }

  if (contractorId) {
    where.escrowPayment = { contractorId };
  }

  const milestones = await prisma.milestone.findMany({
    where,
    orderBy: { approvedAt: 'desc' },
    take:    200,
    select: {
      id: true, amount: true, status: true, stripeTransferId: true, approvedAt: true,
      escrowPayment: {
        select: {
          contractorId: true,
          job: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (milestones.length === 0) return [];

  const contractorIds = [...new Set(milestones.map(m => m.escrowPayment.contractorId))];
  const contractors   = await prisma.user.findMany({
    where:  { id: { in: contractorIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const cMap = new Map(contractors.map(c => [c.id, `${c.firstName} ${c.lastName}`]));

  return milestones.map(m => ({
    id:             m.id,
    contractorId:   m.escrowPayment.contractorId,
    contractorName: cMap.get(m.escrowPayment.contractorId) ?? 'Unknown',
    jobId:          m.escrowPayment.job.id,
    jobTitle:       m.escrowPayment.job.title,
    amount:         m.amount,
    stripePayoutId: m.stripeTransferId,
    status:         m.status === 'RELEASED' ? 'processed' : m.status === 'APPROVED' ? 'pending' : m.status.toLowerCase(),
    createdAt:      (m.approvedAt ?? new Date()).toISOString(),
  }));
}

// ── retryPayout ───────────────────────────────────────────────────────────────
// payoutId = Milestone ID. Re-creates the Stripe transfer for a milestone
// that is APPROVED but whose webhook hasn't confirmed the RELEASED status.

export async function retryPayout(
  milestoneId: string,
): Promise<{ stripeTransferId: string }> {
  const milestone = await prisma.milestone.findUnique({
    where:   { id: milestoneId },
    include: {
      escrowPayment: true,
    },
  });
  if (!milestone) throw new AppError('Milestone not found', 404);

  if (!['APPROVED', 'PENDING'].includes(milestone.status)) {
    throw new AppError(
      `Cannot retry payout for milestone in status ${milestone.status}`,
      400,
    );
  }

  // Look up contractor's Stripe Express account
  const stripeAccount = await prisma.contractorStripeAccount.findUnique({
    where: { userId: milestone.escrowPayment.contractorId },
  });
  if (!stripeAccount || !stripeAccount.chargesEnabled) {
    throw new AppError('Contractor has not completed Stripe onboarding', 422);
  }

  // Create a new transfer
  const transfer = await stripe.transfers.create({
    amount:         Math.round(milestone.amount * 100),
    currency:       'usd',
    destination:    stripeAccount.stripeAccountId,
    transfer_group: milestone.escrowPayment.id,
    metadata:       { milestoneId, retried: 'true' },
  });

  // Update milestone with new transfer ID
  await prisma.milestone.update({
    where: { id: milestoneId },
    data:  { stripeTransferId: transfer.id },
  });

  return { stripeTransferId: transfer.id };
}

// ── getFailedTransactions ─────────────────────────────────────────────────────
// Returns a merged list of:
// 1. EscrowPayments with status CANCELLED that had a Stripe intent (payment failed/cancelled)
// 2. Milestones APPROVED > 1 hour ago with no releasedAt (stale transfer — possible webhook miss)

export async function getFailedTransactions(): Promise<FailedItem[]> {
  const staleThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  const [cancelledEscrows, staleMilestones] = await Promise.all([
    prisma.escrowPayment.findMany({
      where: {
        status: 'CANCELLED',
        stripePaymentIntentId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take:    100,
      select: {
        id: true, investorId: true, totalAmount: true,
        status: true, stripePaymentIntentId: true, createdAt: true,
        job: { select: { id: true, title: true } },
      },
    }),
    prisma.milestone.findMany({
      where: {
        status:           'APPROVED',
        stripeTransferId: { not: null },
        approvedAt:       { lt: staleThreshold },
        releasedAt:       null,
      },
      orderBy: { approvedAt: 'desc' },
      take:    100,
      select: {
        id: true, amount: true, status: true, stripeTransferId: true, approvedAt: true,
        escrowPayment: {
          select: {
            contractorId: true,
            job: { select: { id: true, title: true } },
          },
        },
      },
    }),
  ]);

  // Batch user lookups
  const investorIds    = cancelledEscrows.map(e => e.investorId);
  const contractorIds  = staleMilestones.map(m => m.escrowPayment.contractorId);
  const allUserIds     = [...new Set([...investorIds, ...contractorIds])];
  const users          = allUserIds.length > 0
    ? await prisma.user.findMany({
        where:  { id: { in: allUserIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const uMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

  const result: FailedItem[] = [
    ...cancelledEscrows.map(e => ({
      id:        e.id,
      type:      'failed_deposit' as const,
      jobId:     e.job.id,
      jobTitle:  e.job.title,
      partyName: uMap.get(e.investorId) ?? 'Unknown',
      amount:    e.totalAmount,
      stripeId:  e.stripePaymentIntentId,
      status:    e.status,
      createdAt: e.createdAt.toISOString(),
    })),
    ...staleMilestones.map(m => ({
      id:        m.id,
      type:      'failed_payout' as const,
      jobId:     m.escrowPayment.job.id,
      jobTitle:  m.escrowPayment.job.title,
      partyName: uMap.get(m.escrowPayment.contractorId) ?? 'Unknown',
      amount:    m.amount,
      stripeId:  m.stripeTransferId,
      status:    'stale_transfer',
      createdAt: (m.approvedAt ?? new Date()).toISOString(),
    })),
  ];

  return result.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ── issueRefund ───────────────────────────────────────────────────────────────

export async function issueRefund(
  jobId:  string,
  amount: number,
  reason: string,
): Promise<{ stripeRefundId: string }> {
  // Validate job status
  const job = await prisma.job.findUnique({
    where:  { id: jobId },
    select: { id: true, status: true },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (!['CANCELLED', 'AWARDED'].includes(job.status)) {
    // DISPUTED jobs go through escrow.service dispute resolution; only CANCELLED/AWARDED here
    throw new AppError(
      `Refunds via admin can only be issued for CANCELLED or AWARDED jobs (current: ${job.status})`,
      400,
    );
  }

  const escrow = await prisma.escrowPayment.findUnique({ where: { jobId } });
  if (!escrow) throw new AppError('No escrow found for this job', 404);
  if (!escrow.stripePaymentIntentId) {
    throw new AppError('Escrow has no associated Stripe payment intent', 422);
  }
  if (['REFUNDED', 'CANCELLED'].includes(escrow.status)) {
    throw new AppError('Escrow has already been refunded or cancelled', 409);
  }

  // Validate refund amount ≤ total
  if (amount <= 0 || amount > escrow.totalAmount) {
    throw new AppError(
      `Refund amount must be between $0.01 and $${escrow.totalAmount.toFixed(2)}`,
      400,
    );
  }

  // Issue Stripe refund
  const refund = await stripe.refunds.create({
    payment_intent: escrow.stripePaymentIntentId,
    amount:         Math.round(amount * 100),
    reason:         'requested_by_customer',
    metadata:       { jobId, adminReason: reason.slice(0, 500) },
  });

  // Update escrow status if full refund
  const isFullRefund = Math.abs(amount - escrow.totalAmount) < 0.01;
  if (isFullRefund) {
    await prisma.escrowPayment.update({
      where: { id: escrow.id },
      data:  { status: 'REFUNDED' },
    });
  }

  return { stripeRefundId: refund.id };
}
