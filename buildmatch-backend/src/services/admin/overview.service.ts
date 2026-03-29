/**
 * src/services/admin/overview.service.ts
 *
 * Aggregated data for the Admin Overview dashboard.
 * Three exports: getOverviewStats (60s cache), getOverviewActivity, getOverviewAlerts.
 */

import prisma from '../../lib/prisma';
import { getServiceClient } from '../../lib/supabase';

// ── In-memory cache for stats ─────────────────────────────────────────────────

let _statsCache: OverviewStats | null = null;
let _statsExpiry                       = 0;
const CACHE_TTL_MS                     = 60_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OverviewStats {
  users: {
    total:       number;
    investors:   number;
    contractors: number;
    newToday:    number;
    newThisWeek: number;
    newThisMonth: number;
  };
  jobs: {
    total:              number;
    open:               number;
    inProgress:         number;
    completedThisMonth: number;
    postedToday:        number;
  };
  finance: {
    totalGmv:                 number;
    gmvThisMonth:             number;
    platformRevenueTotal:     number;
    platformRevenueThisMonth: number;
    fundsInEscrow:            number;
    avgJobValue:              number;
  };
  disputes: {
    open:               number;
    resolvedThisMonth:  number;
  };
  moderation: {
    queueSize: number;
  };
}

export interface ActivityEvent {
  type:        'user_signup' | 'job_posted' | 'bid_submitted' | 'dispute_filed' | 'message_filtered';
  description: string;
  userId:      string;
  userName:    string;
  link:        string;
  createdAt:   string;
}

export interface OverviewAlert {
  severity:  'critical' | 'warning' | 'info';
  type:      string;
  message:   string;
  link:      string;
  createdAt: string;
}

// ── getOverviewStats ──────────────────────────────────────────────────────────

export async function getOverviewStats(): Promise<OverviewStats> {
  if (_statsCache && Date.now() < _statsExpiry) return _statsCache;

  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const monthAgo   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    userGroups,
    newToday,
    newThisWeek,
    newThisMonth,
    jobGroups,
    postedToday,
    completedThisMonth,
    escrowTotal,
    escrowActive,
    escrowThisMonth,
    openDisputesRes,
    resolvedThisMonthRes,
    modQueueSize,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo   } } }),
    prisma.user.count({ where: { createdAt: { gte: monthAgo  } } }),
    prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.job.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.job.count({ where: { status: 'COMPLETED', updatedAt: { gte: monthStart } } }),

    // All-time GMV + platform fee + average job value
    prisma.escrowPayment.aggregate({
      _sum: { totalAmount: true, platformFeeAmount: true },
      _avg: { totalAmount: true },
    }),

    // Funds currently locked in escrow (FUNDED or IN_PROGRESS)
    prisma.escrowPayment.aggregate({
      where: { status: { in: ['FUNDED', 'IN_PROGRESS'] } },
      _sum: { totalAmount: true },
    }),

    // This-month GMV + platform fee
    prisma.escrowPayment.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { totalAmount: true, platformFeeAmount: true },
    }),

    // Open dispute count
    getServiceClient()
      .from('disputes')
      .select('id')
      .eq('status', 'OPEN'),

    // Disputes resolved this month
    getServiceClient()
      .from('disputes')
      .select('id')
      .in('status', ['RESOLVED', 'CLOSED'])
      .gte('updated_at', monthStart.toISOString()),

    // Moderation queue — total filtered messages (proxy for items needing review)
    prisma.conversationMessage.count({ where: { isFiltered: true } }),
  ]);

  // Build lookup maps
  const roleMap: Record<string, number> = {};
  for (const g of userGroups) roleMap[g.role] = g._count._all;

  const jobMap: Record<string, number> = {};
  for (const g of jobGroups) jobMap[g.status] = g._count._all;
  const totalJobs = Object.values(jobMap).reduce((s, v) => s + v, 0);

  const stats: OverviewStats = {
    users: {
      total:        Object.values(roleMap).reduce((s, v) => s + v, 0),
      investors:    roleMap['INVESTOR']   ?? 0,
      contractors:  roleMap['CONTRACTOR'] ?? 0,
      newToday,
      newThisWeek,
      newThisMonth,
    },
    jobs: {
      total:              totalJobs,
      open:               jobMap['OPEN']        ?? 0,
      inProgress:         jobMap['IN_PROGRESS'] ?? 0,
      completedThisMonth,
      postedToday,
    },
    finance: {
      totalGmv:                 escrowTotal._sum.totalAmount         ?? 0,
      gmvThisMonth:             escrowThisMonth._sum.totalAmount     ?? 0,
      platformRevenueTotal:     escrowTotal._sum.platformFeeAmount   ?? 0,
      platformRevenueThisMonth: escrowThisMonth._sum.platformFeeAmount ?? 0,
      fundsInEscrow:            escrowActive._sum.totalAmount        ?? 0,
      avgJobValue:              escrowTotal._avg.totalAmount         ?? 0,
    },
    disputes: {
      open:              (openDisputesRes.data        ?? []).length,
      resolvedThisMonth: (resolvedThisMonthRes.data   ?? []).length,
    },
    moderation: {
      queueSize: modQueueSize,
    },
  };

  _statsCache  = stats;
  _statsExpiry = Date.now() + CACHE_TTL_MS;
  return stats;
}

// ── getOverviewActivity ───────────────────────────────────────────────────────

export async function getOverviewActivity(): Promise<ActivityEvent[]> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Parallel fetch from all 5 sources
  const [users, jobs, bids, disputesRes, filteredMessages] = await Promise.all([
    prisma.user.findMany({
      where:   { createdAt: { gte: since24h } },
      take:    20,
      orderBy: { createdAt: 'desc' },
      select:  { id: true, firstName: true, lastName: true, role: true, createdAt: true },
    }),
    prisma.job.findMany({
      where:   { createdAt: { gte: since24h } },
      take:    20,
      orderBy: { createdAt: 'desc' },
      select:  { id: true, title: true, investorId: true, createdAt: true },
    }),
    prisma.bid.findMany({
      where:   { createdAt: { gte: since24h } },
      take:    20,
      orderBy: { createdAt: 'desc' },
      select:  {
        id: true, jobId: true, contractorId: true, amount: true, createdAt: true,
        job: { select: { title: true } },
      },
    }),
    getServiceClient()
      .from('disputes')
      .select('id, filed_by_id, created_at')
      .gte('created_at', since24h.toISOString())
      .order('created_at', { ascending: false })
      .limit(20),
    prisma.conversationMessage.findMany({
      where:   { isFiltered: true, createdAt: { gte: since24h } },
      take:    20,
      orderBy: { createdAt: 'desc' },
      select:  { id: true, senderId: true, conversationId: true, createdAt: true },
    }),
  ]);

  const disputes = (disputesRes.data ?? []) as {
    id: string; filed_by_id: string; created_at: string;
  }[];

  // Batch-fetch names for all IDs that need enrichment
  const idsToFetch = [
    ...new Set([
      ...jobs.map(j => j.investorId),
      ...bids.map(b => b.contractorId),
      ...disputes.map(d => d.filed_by_id),
      ...filteredMessages.map(m => m.senderId),
    ]),
  ];

  const nameMap = new Map<string, string>();
  if (idsToFetch.length > 0) {
    const enriched = await prisma.user.findMany({
      where:  { id: { in: idsToFetch } },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const u of enriched) nameMap.set(u.id, `${u.firstName} ${u.lastName}`);
  }

  const events: ActivityEvent[] = [];

  for (const u of users) {
    events.push({
      type:        'user_signup',
      description: `${u.firstName} ${u.lastName} joined as ${u.role.toLowerCase()}`,
      userId:      u.id,
      userName:    `${u.firstName} ${u.lastName}`,
      link:        `/admin/users/${u.id}`,
      createdAt:   u.createdAt.toISOString(),
    });
  }

  for (const j of jobs) {
    events.push({
      type:        'job_posted',
      description: `Job posted: "${j.title}"`,
      userId:      j.investorId,
      userName:    nameMap.get(j.investorId) ?? 'Unknown',
      link:        `/admin/jobs/${j.id}`,
      createdAt:   j.createdAt.toISOString(),
    });
  }

  for (const b of bids) {
    events.push({
      type:        'bid_submitted',
      description: `Bid submitted on "${b.job.title}"`,
      userId:      b.contractorId,
      userName:    nameMap.get(b.contractorId) ?? 'Unknown',
      link:        `/admin/jobs/${b.jobId}`,
      createdAt:   b.createdAt.toISOString(),
    });
  }

  for (const d of disputes) {
    events.push({
      type:        'dispute_filed',
      description: 'Dispute filed',
      userId:      d.filed_by_id,
      userName:    nameMap.get(d.filed_by_id) ?? 'Unknown',
      link:        `/admin/disputes/${d.id}`,
      createdAt:   d.created_at,
    });
  }

  for (const m of filteredMessages) {
    events.push({
      type:        'message_filtered',
      description: 'Message flagged for policy violation',
      userId:      m.senderId,
      userName:    nameMap.get(m.senderId) ?? 'Unknown',
      link:        '/admin/moderation',
      createdAt:   m.createdAt.toISOString(),
    });
  }

  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return events.slice(0, 50);
}

// ── getOverviewAlerts ─────────────────────────────────────────────────────────

export async function getOverviewAlerts(): Promise<OverviewAlert[]> {
  const now      = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo    = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Parallel fetches for everything that doesn't depend on a prior result
  const [
    failedPayouts,
    staleDisputesRes,
    staleJobs,
    filteredMsgs24h,
    contractor90dDisputesRes,
    newUsersToday,
    usersLast7d,
  ] = await Promise.all([
    // CRITICAL — milestone payout with no Stripe transfer recorded in last 24h
    prisma.milestone.findMany({
      where:  { releasedAt: { gte: since24h }, stripeTransferId: null },
      select: { id: true, amount: true, escrowPaymentId: true },
      take:   20,
    }),

    // CRITICAL — disputes open > 7 days (check audit log next)
    getServiceClient()
      .from('disputes')
      .select('id, created_at')
      .in('status', ['OPEN', 'UNDER_REVIEW', 'AWAITING_EVIDENCE', 'PENDING_RULING'])
      .lt('created_at', since7d.toISOString()),

    // WARNING — jobs IN_PROGRESS for > 30 days
    prisma.job.findMany({
      where:  { status: 'IN_PROGRESS', createdAt: { lt: since30d } },
      select: { id: true, title: true, createdAt: true },
      take:   20,
    }),

    // WARNING — users with 5+ filtered messages in last 24h
    prisma.conversationMessage.findMany({
      where:  { isFiltered: true, createdAt: { gte: since24h } },
      select: { senderId: true },
    }),

    // WARNING — contractors with 3+ disputes (filed against them) in 90 days
    getServiceClient()
      .from('disputes')
      .select('against_id')
      .gte('created_at', since90d.toISOString()),

    // INFO — growth spike comparison
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo   } } }),
  ]);

  const alerts: OverviewAlert[] = [];

  // ── CRITICAL: failed Stripe payouts ────────────────────────────────────────
  for (const mp of failedPayouts) {
    alerts.push({
      severity:  'critical',
      type:      'PAYOUT_FAILED',
      message:   `Milestone payout of $${mp.amount.toFixed(2)} failed — no Stripe transfer recorded`,
      link:      '/admin/finance',
      createdAt: now.toISOString(),
    });
  }

  // ── CRITICAL: stale disputes with no admin action ──────────────────────────
  const staleDisputes = (staleDisputesRes.data ?? []) as { id: string; created_at: string }[];

  if (staleDisputes.length > 0) {
    // Sequential: need stale IDs before we can query audit_log
    const staleIds = staleDisputes.map(d => d.id);
    const auditRes = await getServiceClient()
      .from('audit_log')
      .select('target_id')
      .in('target_id', staleIds)
      .in('action', ['DISPUTE_RULING', 'DISPUTE_NOTE', 'DISPUTE_CLOSE']);

    const actedIds = new Set(
      ((auditRes.data ?? []) as { target_id: string }[]).map(r => r.target_id),
    );

    for (const d of staleDisputes) {
      if (actedIds.has(d.id)) continue;
      const daysOld = Math.floor(
        (now.getTime() - new Date(d.created_at).getTime()) / (24 * 60 * 60 * 1000),
      );
      alerts.push({
        severity:  'critical',
        type:      'DISPUTE_STALE',
        message:   `Dispute open for ${daysOld} days with no admin action`,
        link:      `/admin/disputes/${d.id}`,
        createdAt: d.created_at,
      });
    }
  }

  // ── WARNING: jobs IN_PROGRESS > 30 days ────────────────────────────────────
  for (const job of staleJobs) {
    const daysOld = Math.floor(
      (now.getTime() - job.createdAt.getTime()) / (24 * 60 * 60 * 1000),
    );
    alerts.push({
      severity:  'warning',
      type:      'JOB_STALE',
      message:   `"${job.title}" has been IN_PROGRESS for ${daysOld} days with no milestone activity`,
      link:      `/admin/jobs/${job.id}`,
      createdAt: job.createdAt.toISOString(),
    });
  }

  // ── WARNING: user message-filter abuse ─────────────────────────────────────
  const countBySender = new Map<string, number>();
  for (const m of filteredMsgs24h) {
    countBySender.set(m.senderId, (countBySender.get(m.senderId) ?? 0) + 1);
  }
  for (const [userId, count] of countBySender) {
    if (count < 5) continue;
    alerts.push({
      severity:  'warning',
      type:      'FILTER_ABUSE',
      message:   `User triggered message filter ${count} times in the last 24 hours`,
      link:      `/admin/users/${userId}`,
      createdAt: now.toISOString(),
    });
  }

  // ── WARNING: contractor with 3+ disputes in 90 days ────────────────────────
  const d90Rows = (contractor90dDisputesRes.data ?? []) as { against_id: string | null }[];
  const disputesByUser = new Map<string, number>();
  for (const r of d90Rows) {
    if (!r.against_id) continue;
    disputesByUser.set(r.against_id, (disputesByUser.get(r.against_id) ?? 0) + 1);
  }

  const heavyIds = [...disputesByUser.entries()]
    .filter(([, count]) => count >= 3)
    .map(([id]) => id);

  if (heavyIds.length > 0) {
    const contractorUsers = await prisma.user.findMany({
      where:  { id: { in: heavyIds }, role: 'CONTRACTOR' },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const u of contractorUsers) {
      const count = disputesByUser.get(u.id)!;
      alerts.push({
        severity:  'warning',
        type:      'CONTRACTOR_DISPUTES',
        message:   `${u.firstName} ${u.lastName} has ${count} disputes filed against them in the last 90 days`,
        link:      `/admin/users/${u.id}`,
        createdAt: now.toISOString(),
      });
    }
  }

  // ── INFO: user growth spike ────────────────────────────────────────────────
  const dailyAvg7d = usersLast7d / 7;
  if (dailyAvg7d > 0 && newUsersToday >= 2 * dailyAvg7d) {
    alerts.push({
      severity:  'info',
      type:      'GROWTH_SPIKE',
      message:   `${newUsersToday} new users today — ${(newUsersToday / dailyAvg7d).toFixed(1)}× the 7-day daily average`,
      link:      '/admin/users',
      createdAt: now.toISOString(),
    });
  }

  return alerts;
}
