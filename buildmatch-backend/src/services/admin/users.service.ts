/**
 * src/services/admin/users.service.ts
 *
 * All admin user-management business logic.
 * Routes should call these functions and handle HTTP concerns separately.
 */

import jwt         from 'jsonwebtoken';
import prisma      from '../../lib/prisma';
import type { Prisma } from '@prisma/client';
import { getServiceClient } from '../../lib/supabase';
import { AppError }  from '../../utils/app-error';
import { banEmail }  from './banned-emails.service';

// ── Email delivery (mirrors dispute-notifications.service.ts) ─────────────────

const SITE_URL     = (process.env.FRONTEND_URL ?? 'https://buildmatch.com').replace(/\/$/, '');
const FROM_NAME    = 'BuildMatch Support';
const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'support@buildmatch.com';

interface EmailMsg { to: string; subject: string; html: string; }

async function deliverEmail(msg: EmailMsg): Promise<void> {
  // TODO: wire in provider (Resend / SendGrid / Postmark) — currently console only
  console.log(`[admin/users email] → ${msg.to} | ${msg.subject}`);
}

function buildHtml(heading: string, paragraphs: string[]): string {
  const body = paragraphs
    .map(p => `<p style="margin:0 0 14px;font-size:14px;color:#374151;line-height:1.6;">${p}</p>`)
    .join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F8F7F5;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
  style="background:#fff;border:1px solid #E5E4E0;border-radius:12px;overflow:hidden;max-width:560px;">
<tr><td style="padding:20px 32px;background:#1B3A5C;">
  <p style="margin:0;font-size:18px;font-weight:600;color:#fff;">${FROM_NAME}</p></td></tr>
<tr><td style="padding:32px;">
  <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#1A1A18;">${heading}</h1>
  ${body}</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #E5E4E0;background:#F8F7F5;">
  <p style="margin:0;font-size:11px;color:#6B6B67;">
    You are receiving this email from ${FROM_NAME}.
    <a href="${SITE_URL}/dashboard/settings" style="color:#0F6E56;">Manage preferences</a>
  </p></td></tr></table></td></tr></table></body></html>`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminUserListItem {
  id:            string;
  email:         string;
  firstName:     string;
  lastName:      string;
  role:          string;
  isActive:      boolean;
  isVerified:    boolean;
  isBanned:      boolean;
  suspendedUntil: string | null;
  avatarUrl:     string | null;
  createdAt:     string;
  jobCount:      number;
  bidCount:      number;
}

export interface AdminUserPage {
  data:       AdminUserListItem[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

export interface ContractorSummary {
  id:                string;
  specialties:       string[];
  averageRating:     number;
  completedJobs:     number;
  reliabilityScore:  number;
  isLicenseVerified: boolean;
  isAvailable:       boolean;
  city:              string | null;
  state:             string | null;
  hourlyRateMin:     number | null;
  hourlyRateMax:     number | null;
}

export interface AdminUserFullProfile extends AdminUserListItem {
  phone:        string | null;
  city:         string | null;
  state:        string | null;
  company:      string | null;
  title:        string | null;
  website:      string | null;
  bio:          string | null;
  updatedAt:    string;
  lastSignInAt: string | null;

  // Finance
  totalSpend:       number;   // investors: sum of escrow total
  totalEarnings:    number;   // contractors: sum of released milestones
  platformFeesPaid: number;   // investors: sum of platform fees

  // Activity counts
  messageFilterCount: number;

  // Related data
  contractor:           ContractorSummary | null;
  jobs:                 { id: string; title: string; status: string; budgetMin: number; budgetMax: number; createdAt: string }[];
  bids:                 { id: string; jobId: string; jobTitle: string; amount: number; status: string; createdAt: string }[];
  recentMessages:       { id: string; conversationId: string; content: string; isFiltered: boolean; createdAt: string }[];
  reviews:              { id: string; rating: number; title: string; body: string; reviewerRole: string; createdAt: string }[];
  disputes:             { id: string; status: string; category: string; createdAt: string; filedById: string; againstId: string }[];
  accountStatusHistory: { action: string; adminId: string; note: string | null; createdAt: string }[];
}

export interface FlaggedUser {
  id:            string;
  email:         string;
  firstName:     string;
  lastName:      string;
  role:          string;
  isActive:      boolean;
  isBanned:      boolean;
  avatarUrl:     string | null;
  createdAt:     string;
  severityScore: number;
  filterCount:   number;
  disputeCount:  number;
  reasons:       string[];
}

// ── listUsers ─────────────────────────────────────────────────────────────────

export async function listUsers(params: {
  page:        number;
  limit:       number;
  search?:     string;
  role?:       string;
  status?:     'active' | 'suspended' | 'banned';
  isVerified?: boolean;
  dateFrom?:   string;
  dateTo?:     string;
  sortBy:      string;
  sortDir:     'asc' | 'desc';
}): Promise<AdminUserPage> {
  const { page, limit, search, role, status, isVerified, dateFrom, dateTo, sortBy, sortDir } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { email:     { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName:  { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role) where.role = role as 'INVESTOR' | 'CONTRACTOR' | 'ADMIN';
  if (isVerified != null) where.isVerified = isVerified;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom && { gte: new Date(dateFrom) }),
      ...(dateTo   && { lte: new Date(dateTo)   }),
    };
  }

  if (status === 'active')    { where.isActive = true;  where.isBanned = false; }
  if (status === 'banned')    { where.isBanned = true; }
  if (status === 'suspended') { where.isActive = false; where.isBanned = false; }

  const orderBy: Prisma.UserOrderByWithRelationInput =
    sortBy === 'email'     ? { email:     sortDir } :
    sortBy === 'firstName' ? { firstName: sortDir } :
                             { createdAt: sortDir };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take:    limit,
      orderBy,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, isVerified: true,
        isBanned: true, suspendedUntil: true, avatarUrl: true, createdAt: true,
        _count: { select: { postedJobs: true } },
      },
    }),
  ]);

  // Batch-fetch bid counts for contractors
  const contractorIds = users.filter(u => u.role === 'CONTRACTOR').map(u => u.id);
  const bidCountMap   = new Map<string, number>();
  if (contractorIds.length > 0) {
    const bidGroups = await prisma.bid.groupBy({
      by:    ['contractorId'],
      where: { contractorId: { in: contractorIds } },
      _count: { _all: true },
    });
    for (const g of bidGroups) bidCountMap.set(g.contractorId, g._count._all);
  }

  return {
    data: users.map(u => ({
      id:             u.id,
      email:          u.email,
      firstName:      u.firstName,
      lastName:       u.lastName,
      role:           u.role,
      isActive:       u.isActive,
      isVerified:     u.isVerified,
      isBanned:       u.isBanned,
      suspendedUntil: u.suspendedUntil?.toISOString() ?? null,
      avatarUrl:      u.avatarUrl,
      createdAt:      u.createdAt.toISOString(),
      jobCount:       u._count.postedJobs,
      bidCount:       bidCountMap.get(u.id) ?? 0,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
}

// ── getUserFullProfile ────────────────────────────────────────────────────────

export async function getUserFullProfile(userId: string): Promise<AdminUserFullProfile> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, isActive: true, isVerified: true, isBanned: true,
      suspendedUntil: true, avatarUrl: true, phone: true,
      city: true, state: true, company: true, title: true, website: true, bio: true,
      createdAt: true, updatedAt: true,
      _count: { select: { postedJobs: true } },
      contractor: {
        select: {
          id: true, specialties: true, averageRating: true,
          completedJobs: true, reliabilityScore: true,
          isLicenseVerified: true, isAvailable: true,
          city: true, state: true, hourlyRateMin: true, hourlyRateMax: true,
        },
      },
      postedJobs: {
        orderBy: { createdAt: 'desc' },
        select:  { id: true, title: true, status: true, budgetMin: true, budgetMax: true, createdAt: true },
      },
      reviewsReceived: {
        orderBy: { createdAt: 'desc' },
        select:  { id: true, rating: true, title: true, body: true, reviewerRole: true, createdAt: true },
      },
    },
  });

  if (!user) throw new AppError('User not found', 404);

  // Bids (contractors)
  const bidsRaw = await prisma.bid.findMany({
    where:   { contractorId: userId },
    orderBy: { createdAt: 'desc' },
    select:  {
      id: true, jobId: true, amount: true, status: true, createdAt: true,
      job: { select: { title: true } },
    },
  });

  // Message filter count
  const messageFilterCount = await prisma.conversationMessage.count({
    where: { senderId: userId, isFiltered: true },
  });

  // Recent messages (last 10 across all conversations user is in)
  const userConversations = await prisma.conversation.findMany({
    where:   { OR: [{ investorId: userId }, { contractorId: userId }] },
    take:    20,
    orderBy: { lastMessageAt: 'desc' },
    select:  { id: true },
  });
  const convIds = userConversations.map(c => c.id);
  const recentMessages = convIds.length > 0
    ? await prisma.conversationMessage.findMany({
        where:   { conversationId: { in: convIds } },
        take:    10,
        orderBy: { createdAt: 'desc' },
        select:  { id: true, conversationId: true, content: true, isFiltered: true, createdAt: true },
      })
    : [];

  // Finance aggregates
  const [investorFinance, contractorEarnings] = await Promise.all([
    prisma.escrowPayment.aggregate({
      where: { investorId: userId },
      _sum:  { totalAmount: true, platformFeeAmount: true },
    }),
    prisma.milestone.aggregate({
      where: {
        stripeTransferId:  { not: null },
        releasedAt:        { not: null },
        escrowPayment:     { contractorId: userId },
      },
      _sum: { amount: true },
    }),
  ]);

  // Disputes from Supabase
  const { data: disputeRows } = await getServiceClient()
    .from('disputes')
    .select('id, status, category, created_at, filed_by_id, against_id')
    .or(`filed_by_id.eq.${userId},against_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  const disputes = ((disputeRows ?? []) as {
    id: string; status: string; category: string;
    created_at: string; filed_by_id: string; against_id: string;
  }[]).map(d => ({
    id:        d.id,
    status:    d.status,
    category:  d.category,
    createdAt: d.created_at,
    filedById: d.filed_by_id,
    againstId: d.against_id,
  }));

  // Account status history (audit_log actions targeting this user)
  const { data: historyRows } = await getServiceClient()
    .from('audit_log')
    .select('action, admin_id, note, created_at')
    .eq('target_id', userId)
    .in('action', ['USER_SUSPEND', 'USER_UNSUSPEND', 'USER_BAN', 'USER_UNBAN'])
    .order('created_at', { ascending: false });

  const accountStatusHistory = ((historyRows ?? []) as {
    action: string; admin_id: string; note: string | null; created_at: string;
  }[]).map(h => ({
    action:    h.action,
    adminId:   h.admin_id,
    note:      h.note,
    createdAt: h.created_at,
  }));

  // Supabase auth last sign-in (best-effort; null when using custom JWT auth)
  let lastSignInAt: string | null = null;
  try {
    const { data: authData } = await getServiceClient().auth.admin.getUserById(userId);
    lastSignInAt = authData?.user?.last_sign_in_at ?? null;
  } catch { /* custom auth — no Supabase auth user */ }

  return {
    id:             user.id,
    email:          user.email,
    firstName:      user.firstName,
    lastName:       user.lastName,
    role:           user.role,
    isActive:       user.isActive,
    isVerified:     user.isVerified,
    isBanned:       user.isBanned,
    suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
    avatarUrl:      user.avatarUrl,
    phone:          user.phone,
    city:           user.city,
    state:          user.state,
    company:        user.company,
    title:          user.title,
    website:        user.website,
    bio:            user.bio,
    createdAt:      user.createdAt.toISOString(),
    updatedAt:      user.updatedAt.toISOString(),
    lastSignInAt,

    totalSpend:        investorFinance._sum.totalAmount      ?? 0,
    platformFeesPaid:  investorFinance._sum.platformFeeAmount ?? 0,
    totalEarnings:     contractorEarnings._sum.amount        ?? 0,
    messageFilterCount,

    jobCount:  user._count.postedJobs,
    bidCount:  bidsRaw.length,

    contractor: user.contractor ? {
      id:                user.contractor.id,
      specialties:       user.contractor.specialties,
      averageRating:     user.contractor.averageRating,
      completedJobs:     user.contractor.completedJobs,
      reliabilityScore:  user.contractor.reliabilityScore,
      isLicenseVerified: user.contractor.isLicenseVerified,
      isAvailable:       user.contractor.isAvailable,
      city:              user.contractor.city,
      state:             user.contractor.state,
      hourlyRateMin:     user.contractor.hourlyRateMin,
      hourlyRateMax:     user.contractor.hourlyRateMax,
    } : null,

    jobs: user.postedJobs.map(j => ({
      id:        j.id,
      title:     j.title,
      status:    j.status,
      budgetMin: j.budgetMin,
      budgetMax: j.budgetMax,
      createdAt: j.createdAt.toISOString(),
    })),

    bids: bidsRaw.map(b => ({
      id:       b.id,
      jobId:    b.jobId,
      jobTitle: b.job.title,
      amount:   b.amount,
      status:   b.status,
      createdAt: b.createdAt.toISOString(),
    })),

    recentMessages: recentMessages.map(m => ({
      id:             m.id,
      conversationId: m.conversationId,
      content:        m.content.slice(0, 120),
      isFiltered:     m.isFiltered,
      createdAt:      m.createdAt.toISOString(),
    })),

    reviews: user.reviewsReceived.map(r => ({
      id:           r.id,
      rating:       r.rating,
      title:        r.title,
      body:         r.body,
      reviewerRole: r.reviewerRole,
      createdAt:    r.createdAt.toISOString(),
    })),

    disputes,
    accountStatusHistory,
  };
}

// ── getFlaggedUsers ───────────────────────────────────────────────────────────

export async function getFlaggedUsers(): Promise<FlaggedUser[]> {
  const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [filteredMsgs, disputeRows] = await Promise.all([
    // 3+ filter triggers in last 7 days
    prisma.conversationMessage.findMany({
      where:  { isFiltered: true, createdAt: { gte: since7d } },
      select: { senderId: true },
    }),
    // disputes filed against user in last 90 days
    getServiceClient()
      .from('disputes')
      .select('against_id, status')
      .gte('created_at', since90d.toISOString()),
  ]);

  // Accumulate filter counts per user
  const filterMap = new Map<string, number>();
  for (const m of filteredMsgs) {
    filterMap.set(m.senderId, (filterMap.get(m.senderId) ?? 0) + 1);
  }

  // Accumulate dispute loss counts per user (resolved/closed cases filed against them)
  const disputeMap = new Map<string, number>();
  for (const d of ((disputeRows.data ?? []) as { against_id: string | null; status: string }[])) {
    if (!d.against_id) continue;
    if (['RESOLVED', 'CLOSED'].includes(d.status)) {
      disputeMap.set(d.against_id, (disputeMap.get(d.against_id) ?? 0) + 1);
    }
  }

  // Collect flagged user IDs
  const filterAbusers  = [...filterMap.entries()].filter(([, n]) => n >= 3).map(([id]) => id);
  const disputeLosers  = [...disputeMap.entries()].filter(([, n]) => n >= 2).map(([id]) => id);
  const flaggedIds     = [...new Set([...filterAbusers, ...disputeLosers])];

  if (flaggedIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where:  { id: { in: flaggedIds } },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, isActive: true, isBanned: true, avatarUrl: true, createdAt: true,
    },
  });

  return users
    .map(u => {
      const filterCount  = filterMap.get(u.id)   ?? 0;
      const disputeCount = disputeMap.get(u.id)  ?? 0;
      const severityScore = filterCount * 10 + disputeCount * 15;

      const reasons: string[] = [];
      if (filterCount  >= 3) reasons.push(`${filterCount} filter triggers in 7 days`);
      if (disputeCount >= 2) reasons.push(`${disputeCount} dispute losses in 90 days`);

      return {
        id:            u.id,
        email:         u.email,
        firstName:     u.firstName,
        lastName:      u.lastName,
        role:          u.role,
        isActive:      u.isActive,
        isBanned:      u.isBanned,
        avatarUrl:     u.avatarUrl,
        createdAt:     u.createdAt.toISOString(),
        severityScore,
        filterCount,
        disputeCount,
        reasons,
      };
    })
    .sort((a, b) => b.severityScore - a.severityScore);
}

// ── suspendUser ───────────────────────────────────────────────────────────────

export async function suspendUser(
  userId:       string,
  reason:       string,
  durationDays: number | null,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, role: true, email: true, firstName: true },
  });
  if (!user)                   throw new AppError('User not found', 404);
  if (user.role === 'ADMIN')   throw new AppError('Cannot suspend an admin account', 403);

  const suspendedUntil = durationDays
    ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
    : null;

  await prisma.user.update({
    where: { id: userId },
    data:  { isActive: false, suspendedUntil },
  });

  const durationText = durationDays ? `for ${durationDays} day${durationDays !== 1 ? 's' : ''}` : 'indefinitely';

  deliverEmail({
    to:      user.email,
    subject: 'Your BuildMatch account has been suspended',
    html:    buildHtml('Your account has been suspended', [
      `Hi ${user.firstName}, your BuildMatch account has been suspended ${durationText}.`,
      `<strong>Reason:</strong> ${reason}`,
      durationDays
        ? `Your account will be automatically reinstated on ${suspendedUntil!.toLocaleDateString()}.`
        : 'Please contact support if you believe this is an error.',
      `<a href="${SITE_URL}/support" style="color:#0F6E56;">Contact Support</a>`,
    ]),
  }).catch(err => console.error('[admin/users] suspend email error:', err));
}

// ── unsuspendUser ─────────────────────────────────────────────────────────────

export async function unsuspendUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, role: true, email: true, firstName: true, isActive: true },
  });
  if (!user) throw new AppError('User not found', 404);

  await prisma.user.update({
    where: { id: userId },
    data:  { isActive: true, suspendedUntil: null },
  });

  deliverEmail({
    to:      user.email,
    subject: 'Your BuildMatch account has been reinstated',
    html:    buildHtml('Your account has been reinstated', [
      `Hi ${user.firstName}, your BuildMatch account has been reinstated. You can now log in and continue using the platform.`,
      `<a href="${SITE_URL}/login" style="color:#0F6E56;">Log in to BuildMatch</a>`,
    ]),
  }).catch(err => console.error('[admin/users] unsuspend email error:', err));
}

// ── banUser ───────────────────────────────────────────────────────────────────

export async function banUser(userId: string, reason: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, role: true, email: true, firstName: true },
  });
  if (!user)                 throw new AppError('User not found', 404);
  if (user.role === 'ADMIN') throw new AppError('Cannot ban an admin account', 403);

  // 1. Mark as banned in Prisma
  await prisma.user.update({
    where: { id: userId },
    data:  { isActive: false, isBanned: true, suspendedUntil: null },
  });

  // 2. Add email to banned_emails table (blocks re-registration)
  await banEmail('system', user.email, reason).catch(() => {
    // Non-fatal: email may already be in banned list
  });

  // 3. Attempt Supabase auth deletion (best-effort; userId is Prisma cuid, not Supabase UUID)
  // This is a no-op in custom JWT auth mode. When migrating to Supabase auth, store
  // the Supabase auth UUID alongside the Prisma id and pass it here instead.
  getServiceClient().auth.admin.deleteUser(userId).catch(() => { /* expected in custom auth */ });
}

// ── verifyContractor ──────────────────────────────────────────────────────────

export async function verifyContractor(userId: string): Promise<void> {
  const profile = await prisma.contractorProfile.findUnique({
    where:  { userId },
    select: { id: true },
  });
  if (!profile) throw new AppError('Contractor profile not found for this user', 404);

  await prisma.contractorProfile.update({
    where: { userId },
    data:  { isLicenseVerified: true },
  });
}

// ── changeUserRole ────────────────────────────────────────────────────────────

export async function changeUserRole(
  userId:  string,
  newRole: 'INVESTOR' | 'CONTRACTOR',
  adminId: string,
): Promise<{ previousRole: string }> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, role: true },
  });
  if (!user)               throw new AppError('User not found', 404);
  if (user.id === adminId) throw new AppError('Cannot change your own role', 403);
  if (user.role === 'ADMIN') throw new AppError('Cannot change the role of another admin', 403);

  const previousRole = user.role as string;

  // Update role; create contractor profile if switching TO CONTRACTOR
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role: newRole } });

    if (newRole === 'CONTRACTOR') {
      await tx.contractorProfile.upsert({
        where:  { userId },
        update: {},                       // leave existing profile untouched
        create: { userId, specialties: [] },
      });
    }
  });

  return { previousRole };
}

// ── impersonateUser ───────────────────────────────────────────────────────────

export async function impersonateUser(
  userId:  string,
  adminId: string,
): Promise<{ token: string; userEmail: string; userRole: string }> {
  if (userId === adminId) throw new AppError('Cannot impersonate yourself', 400);

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, role: true, email: true, isActive: true, isBanned: true },
  });
  if (!user)         throw new AppError('User not found', 404);
  if (user.isBanned) throw new AppError('Cannot impersonate a banned user', 403);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError('JWT_SECRET not configured', 500);

  // Short-lived 30-minute token with impersonation flag
  const token = jwt.sign(
    { userId: user.id, role: user.role, impersonatedBy: adminId },
    secret,
    { expiresIn: '30m' },
  );

  return { token, userEmail: user.email, userRole: user.role };
}

// ── sendAdminMessage ──────────────────────────────────────────────────────────
//
// Delivers a direct message from BuildMatch Support to the user.
// Currently email-only. Full in-app inbox delivery requires a dedicated
// system_notifications table or a SYSTEM pseudo-user in the users table.

export async function sendAdminMessage(
  userId:  string,
  subject: string,
  content: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { email: true, firstName: true },
  });
  if (!user) throw new AppError('User not found', 404);

  await deliverEmail({
    to:      user.email,
    subject: `[${FROM_NAME}] ${subject}`,
    html:    buildHtml(subject, [
      `Hi ${user.firstName},`,
      content,
      `This message was sent from the BuildMatch admin team. <a href="${SITE_URL}/support" style="color:#0F6E56;">Contact Support</a>`,
    ]),
  });
}

// ── setUserActive (kept for internal compatibility) ───────────────────────────

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user)                 throw new AppError('User not found', 404);
  if (user.role === 'ADMIN') throw new AppError('Cannot deactivate an admin account', 403);
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
}
