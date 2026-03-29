import prisma from '../../lib/prisma';
import { getServiceClient } from '../../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformStats {
  users: {
    total:       number;
    investors:   number;
    contractors: number;
    admins:      number;
    newLast7d:   number;
    newLast30d:  number;
    active:      number;
  };
  jobs: {
    total:      number;
    open:       number;
    awarded:    number;
    inProgress: number;
    completed:  number;
    cancelled:  number;
  };
  contractors: {
    total:           number;
    available:       number;
    licenseVerified: number;
  };
  disputes: {
    total:       number;
    open:        number;
    underReview: number;
    resolved:    number;
  };
}

export interface RecentActivityItem {
  type:      'user_signup' | 'job_posted' | 'dispute_filed';
  label:     string;
  sublabel:  string;
  id:        string;
  createdAt: string;
}

// ── getPlatformStats ──────────────────────────────────────────────────────────

export async function getPlatformStats(): Promise<PlatformStats> {
  const now    = new Date();
  const d7ago  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const d30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    userGroups,
    jobGroups,
    contractorAgg,
    disputeRes,
    activeUsers,
    newLast7d,
    newLast30d,
    availableContractors,
    verifiedContractors,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.contractorProfile.aggregate({ _count: { _all: true } }),
    getServiceClient().from('disputes').select('status'),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { createdAt: { gte: d7ago } } }),
    prisma.user.count({ where: { createdAt: { gte: d30ago } } }),
    prisma.contractorProfile.count({ where: { isAvailable: true } }),
    prisma.contractorProfile.count({ where: { isLicenseVerified: true } }),
  ]);

  // Build lookup maps
  const roleMap: Record<string, number> = {};
  for (const g of userGroups) roleMap[g.role] = g._count._all;

  const jobMap: Record<string, number> = {};
  for (const g of jobGroups) jobMap[g.status] = g._count._all;
  const totalJobs = Object.values(jobMap).reduce((s, v) => s + v, 0);

  const dRows = (disputeRes.data ?? []) as { status: string }[];

  return {
    users: {
      total:       Object.values(roleMap).reduce((s, v) => s + v, 0),
      investors:   roleMap['INVESTOR']   ?? 0,
      contractors: roleMap['CONTRACTOR'] ?? 0,
      admins:      roleMap['ADMIN']      ?? 0,
      newLast7d,
      newLast30d,
      active:      activeUsers,
    },
    jobs: {
      total:      totalJobs,
      open:       jobMap['OPEN']        ?? 0,
      awarded:    jobMap['AWARDED']     ?? 0,
      inProgress: jobMap['IN_PROGRESS'] ?? 0,
      completed:  jobMap['COMPLETED']   ?? 0,
      cancelled:  jobMap['CANCELLED']   ?? 0,
    },
    contractors: {
      total:           contractorAgg._count._all,
      available:       availableContractors,
      licenseVerified: verifiedContractors,
    },
    disputes: {
      total:       dRows.length,
      open:        dRows.filter(r => r.status === 'OPEN').length,
      underReview: dRows.filter(r =>
        ['UNDER_REVIEW', 'AWAITING_EVIDENCE', 'PENDING_RULING'].includes(r.status)).length,
      resolved:    dRows.filter(r =>
        ['RESOLVED', 'CLOSED'].includes(r.status)).length,
    },
  };
}

// ── getRecentActivity ─────────────────────────────────────────────────────────

export async function getRecentActivity(limit = 20): Promise<RecentActivityItem[]> {
  const take = Math.ceil(limit / 3);

  const [users, jobs, disputeRes] = await Promise.all([
    prisma.user.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      select:  { id: true, firstName: true, lastName: true, role: true, createdAt: true },
    }),
    prisma.job.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      select:  { id: true, title: true, tradeType: true, status: true, createdAt: true },
    }),
    getServiceClient()
      .from('disputes')
      .select('id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(take),
  ]);

  const items: RecentActivityItem[] = [];

  for (const u of users) {
    items.push({
      type:      'user_signup',
      label:     `${u.firstName} ${u.lastName} joined`,
      sublabel:  u.role,
      id:        u.id,
      createdAt: u.createdAt.toISOString(),
    });
  }
  for (const j of jobs) {
    items.push({
      type:      'job_posted',
      label:     j.title,
      sublabel:  j.tradeType,
      id:        j.id,
      createdAt: j.createdAt.toISOString(),
    });
  }
  for (const d of (disputeRes.data ?? []) as { id: string; status: string; created_at: string }[]) {
    items.push({
      type:      'dispute_filed',
      label:     'Dispute filed',
      sublabel:  d.status,
      id:        d.id,
      createdAt: d.created_at,
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, limit);
}
