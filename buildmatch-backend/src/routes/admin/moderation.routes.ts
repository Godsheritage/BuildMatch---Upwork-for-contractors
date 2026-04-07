/**
 * src/routes/admin/moderation.routes.ts
 * Mounted at: /api/admin/moderation
 * Guards:     authenticate + requireAdmin (applied in admin/index.ts)
 *
 * GET  /filtered-messages              — paginated filtered-message queue
 * POST /messages/:messageId/warn-user  — send ToS warning to message sender
 * POST /messages/:messageId/escalate   — flag sender for immediate review
 * GET  /content-queue                  — merged flagged jobs + reviews
 * POST /content/:type/:id/approve      — clear flag, keep item visible
 * POST /content/:type/:id/remove       — cancel job or soft-delete review
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { getServiceClient } from '../../lib/supabase';
import { writeAuditLog } from '../../services/admin/audit.service';
import prisma from '../../lib/prisma';

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const filteredMsgsSchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(25),
  userId:   z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo:   z.string().optional(),
});

const removeBodySchema = z.object({
  reason: z.string().min(1).max(500),
});

// ── Raw-query type for unflagged Review rows (new columns not in Prisma schema) ─

interface FlaggedReviewRow {
  id:          string;
  title:       string;
  body:        string;
  reviewerId:  string;
  createdAt:   Date;
}

// ── Warning message text ───────────────────────────────────────────────────────

const WARNING_TEXT =
  'BuildMatch Moderation: You attempted to share contact information outside the ' +
  'platform. This violates our Terms of Service. Continued violations will result ' +
  'in account suspension.';

// ── GET /filtered-messages ────────────────────────────────────────────────────
//
// Returns ConversationMessages where isFiltered = true, enriched with:
//   sender + recipient user info, job title, sender_filter_count.
// NOTE: `content` is the stored post-filter value (original is never persisted).

router.get('/filtered-messages', async (req: Request, res: Response): Promise<void> => {
  const parsed = filteredMsgsSchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  const { page, limit, userId, dateFrom, dateTo } = parsed.data;

  // Build createdAt filter
  const createdAtFilter: Prisma.DateTimeFilter | undefined =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
        }
      : undefined;

  const where: Prisma.ConversationMessageWhereInput = {
    isFiltered: true,
    ...(userId        ? { senderId: userId } : {}),
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
  };

  try {
    const [messages, total] = await Promise.all([
      prisma.conversationMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        select: {
          id:             true,
          conversationId: true,
          senderId:       true,
          content:        true,
          filterReason:   true,
          createdAt:      true,
          conversation: {
            select: { jobId: true, investorId: true, contractorId: true },
          },
          sender: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
      }),
      prisma.conversationMessage.count({ where }),
    ]);

    if (!messages.length) {
      sendSuccess(res, { data: [], total, page, totalPages: Math.ceil(total / limit), limit });
      return;
    }

    // ── Batch: job titles ──────────────────────────────────────────────────
    const jobIds = [...new Set(messages.map(m => m.conversation.jobId))];
    const jobs   = await prisma.job.findMany({
      where:  { id: { in: jobIds } },
      select: { id: true, title: true },
    });
    const jobMap = new Map(jobs.map(j => [j.id, j.title]));

    // ── Batch: recipients (the other party in each conversation) ──────────
    const recipientIds = [
      ...new Set(
        messages.map(m => {
          const c = m.conversation;
          return c.investorId === m.senderId ? c.contractorId : c.investorId;
        }),
      ),
    ];
    const recipientUsers = await prisma.user.findMany({
      where:  { id: { in: recipientIds } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
    const recipientMap = new Map(recipientUsers.map(u => [u.id, u]));

    // ── Batch: how many filtered messages each sender has sent (ever) ──────
    const senderIds = [...new Set(messages.map(m => m.senderId))];
    const countRows = await prisma.conversationMessage.groupBy({
      by:    ['senderId'],
      where: { senderId: { in: senderIds }, isFiltered: true },
      _count: { id: true },
    });
    const countMap = new Map(countRows.map(r => [r.senderId, r._count.id]));

    sendSuccess(res, {
      data: messages.map(m => {
        const c           = m.conversation;
        const recipientId = c.investorId === m.senderId ? c.contractorId : c.investorId;
        const recipient   = recipientMap.get(recipientId) ?? null;
        return {
          id:             m.id,
          conversationId: m.conversationId,
          jobId:          c.jobId,
          jobTitle:       jobMap.get(c.jobId) ?? '',
          sender: {
            id:    m.sender.id,
            name:  `${m.sender.firstName} ${m.sender.lastName}`,
            email: m.sender.email,
            role:  m.sender.role,
          },
          recipient: recipient
            ? {
                id:    recipient.id,
                name:  `${recipient.firstName} ${recipient.lastName}`,
                email: recipient.email,
                role:  recipient.role,
              }
            : null,
          filteredContent:  m.content,   // stored post-filter (cleaned) value
          filterReason:     m.filterReason,
          createdAt:        m.createdAt,
          senderFilterCount: countMap.get(m.senderId) ?? 1,
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    console.error('[admin/moderation] GET /filtered-messages error:', err);
    sendError(res, 'Failed to fetch filtered messages', 500);
  }
});

// ── POST /messages/:messageId/warn-user ───────────────────────────────────────
//
// 1. Inserts a system warning message into the same conversation.
// 2. Records the warning in user_warnings (Supabase, service role).
// 3. Logs the admin action.

router.post('/messages/:messageId/warn-user', async (req: Request, res: Response): Promise<void> => {
  const { messageId } = req.params;
  const adminId = req.user!.userId;

  try {
    const message = await prisma.conversationMessage.findUnique({
      where:  { id: messageId },
      select: { id: true, senderId: true, conversationId: true },
    });
    if (!message) { sendError(res, 'Message not found', 404); return; }

    // 1. Insert warning message into the sender's conversation so they see it
    await prisma.conversationMessage.create({
      data: {
        conversationId: message.conversationId,
        senderId:       adminId,
        content:        WARNING_TEXT,
      },
    });

    // 2. Record warning in user_warnings (admin-only Supabase table)
    const supabase = getServiceClient();
    await supabase.from('user_warnings').insert({
      user_id:  message.senderId,
      admin_id: adminId,
      type:     'MESSAGE_FILTER_WARNING',
      note:     `Flagged message id: ${messageId}`,
    });

    // 3. Audit log (fire-and-forget)
    void writeAuditLog({
      adminId,
      action:     'USER_WARN',
      targetType: 'user',
      targetId:   message.senderId,
      payload:    { messageId },
      ipAddress:  req.ip,
    });

    sendSuccess(res, { warned: true, userId: message.senderId });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/moderation] POST /warn-user error:', err);
    sendError(res, 'Failed to warn user', 500);
  }
});

// ── POST /messages/:messageId/escalate ────────────────────────────────────────
//
// Marks the sender as flagged_for_review = true.
// Returns suggestedAction = 'SUSPEND' when the user has 3+ prior warnings.

router.post('/messages/:messageId/escalate', async (req: Request, res: Response): Promise<void> => {
  const { messageId } = req.params;
  const adminId = req.user!.userId;

  try {
    const message = await prisma.conversationMessage.findUnique({
      where:  { id: messageId },
      select: { id: true, senderId: true },
    });
    if (!message) { sendError(res, 'Message not found', 404); return; }

    const userId = message.senderId;

    // Set flagged_for_review = true (new column, not in Prisma schema → raw SQL)
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "User" SET flagged_for_review = true WHERE id = ${userId}`,
    );

    // Count all prior warnings for this user
    const supabase = getServiceClient();
    const { count: flagCount } = await supabase
      .from('user_warnings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const totalFlags      = flagCount ?? 0;
    const suggestedAction = totalFlags >= 3 ? 'SUSPEND' : null;

    // Record this escalation as a warning entry too
    await supabase.from('user_warnings').insert({
      user_id:  userId,
      admin_id: adminId,
      type:     'ESCALATION',
      note:     `Flagged for review via message ${messageId}`,
    });

    void writeAuditLog({
      adminId,
      action:     'USER_ESCALATE',
      targetType: 'user',
      targetId:   userId,
      payload:    { messageId, totalFlags, suggestedAction },
      ipAddress:  req.ip,
    });

    sendSuccess(res, { escalated: true, userId, totalFlags, suggestedAction });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/moderation] POST /escalate error:', err);
    sendError(res, 'Failed to escalate user', 500);
  }
});

// ── GET /content-queue ────────────────────────────────────────────────────────
//
// Merges flagged jobs (Prisma) and flagged reviews (raw SQL — new column).
// Ordered oldest-first.

router.get('/content-queue', async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Flagged jobs (isFlagged is in Prisma schema)
    const flaggedJobs = await prisma.job.findMany({
      where:   { isFlagged: true, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'asc' },
      select:  {
        id: true, title: true, description: true,
        flaggedReason: true, investorId: true, createdAt: true,
      },
    });

    // 2. Flagged reviews (is_flagged added via raw SQL; not in Prisma schema)
    const flaggedReviews = await prisma.$queryRaw<FlaggedReviewRow[]>(
      Prisma.sql`
        SELECT id, title, body, "reviewerId", "createdAt"
        FROM   "Review"
        WHERE  is_flagged = true
          AND  is_deleted = false
        ORDER  BY "createdAt" ASC
      `,
    );

    // 3. Batch user lookups: investors (for jobs) + reviewers (for reviews)
    const investorIds = flaggedJobs.map(j => j.investorId);
    const reviewerIds = flaggedReviews.map(r => r.reviewerId);
    const allUserIds  = [...new Set([...investorIds, ...reviewerIds])];

    const users = allUserIds.length > 0
      ? await prisma.user.findMany({
          where:  { id: { in: allUserIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // 4. Merge and sort oldest-first
    type QueueItem = {
      type:           'job' | 'review';
      id:             string;
      contentPreview: string;
      reason:         string | null;
      reporter:       { id: string; name: string; email: string } | null;
      createdAt:      Date;
    };

    const queue: QueueItem[] = [
      ...flaggedJobs.map(j => {
        const investor = userMap.get(j.investorId) ?? null;
        return {
          type:           'job' as const,
          id:             j.id,
          contentPreview: j.title,
          reason:         j.flaggedReason ?? null,
          reporter:       investor
            ? { id: investor.id, name: `${investor.firstName} ${investor.lastName}`, email: investor.email }
            : null,
          createdAt: j.createdAt,
        };
      }),
      ...flaggedReviews.map(r => {
        const reviewer = userMap.get(r.reviewerId) ?? null;
        return {
          type:           'review' as const,
          id:             r.id,
          contentPreview: r.body.length > 200 ? r.body.slice(0, 200) + '…' : r.body,
          reason:         null,   // no reason stored on Review yet
          reporter:       reviewer
            ? { id: reviewer.id, name: `${reviewer.firstName} ${reviewer.lastName}`, email: reviewer.email }
            : null,
          createdAt: r.createdAt,
        };
      }),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    sendSuccess(res, { queue, total: queue.length });
  } catch (err) {
    console.error('[admin/moderation] GET /content-queue error:', err);
    sendError(res, 'Failed to fetch content queue', 500);
  }
});

// ── POST /content/:type/:id/approve ──────────────────────────────────────────
//
// Clears the flag; item stays visible.
// type = 'job'    → sets isFlagged = false
// type = 'review' → sets is_flagged = false (raw SQL)

router.post('/content/:type/:id/approve', async (req: Request, res: Response): Promise<void> => {
  const { type, id } = req.params;
  const adminId = req.user!.userId;

  if (type !== 'job' && type !== 'review') {
    sendError(res, "type must be 'job' or 'review'", 400);
    return;
  }

  try {
    if (type === 'job') {
      const job = await prisma.job.findUnique({ where: { id }, select: { id: true } });
      if (!job) { sendError(res, 'Job not found', 404); return; }
      await prisma.job.update({ where: { id }, data: { isFlagged: false } });
    } else {
      const rows = await prisma.$executeRaw(
        Prisma.sql`UPDATE "Review" SET is_flagged = false WHERE id = ${id} AND is_deleted = false`,
      );
      if (rows === 0) { sendError(res, 'Review not found', 404); return; }
    }

    void writeAuditLog({
      adminId,
      action:     'CONTENT_APPROVE',
      targetType: type,
      targetId:   id,
      ipAddress:  req.ip,
    });

    sendSuccess(res, { approved: true, type, id });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/moderation] POST /content/approve error:', err);
    sendError(res, 'Failed to approve content', 500);
  }
});

// ── POST /content/:type/:id/remove ───────────────────────────────────────────
//
// Removes flagged content.
// type = 'job'    → sets status = CANCELLED
// type = 'review' → soft-delete (is_deleted = true, raw SQL)

router.post('/content/:type/:id/remove', async (req: Request, res: Response): Promise<void> => {
  const { type, id } = req.params;
  const adminId = req.user!.userId;

  if (type !== 'job' && type !== 'review') {
    sendError(res, "type must be 'job' or 'review'", 400);
    return;
  }

  const bodyParsed = removeBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    sendError(res, bodyParsed.error.issues[0]?.message ?? 'reason is required', 400);
    return;
  }
  const { reason } = bodyParsed.data;

  try {
    if (type === 'job') {
      const job = await prisma.job.findUnique({
        where:  { id },
        select: { id: true, status: true },
      });
      if (!job) { sendError(res, 'Job not found', 404); return; }
      if (job.status === 'CANCELLED') { sendError(res, 'Job is already cancelled', 409); return; }
      await prisma.job.update({ where: { id }, data: { status: 'CANCELLED', isFlagged: false } });
    } else {
      const rows = await prisma.$executeRaw(
        Prisma.sql`UPDATE "Review" SET is_deleted = true, is_flagged = false WHERE id = ${id}`,
      );
      if (rows === 0) { sendError(res, 'Review not found', 404); return; }
    }

    void writeAuditLog({
      adminId,
      action:     'CONTENT_REMOVE',
      targetType: type,
      targetId:   id,
      payload:    { reason },
      ipAddress:  req.ip,
    });

    sendSuccess(res, { removed: true, type, id });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/moderation] POST /content/remove error:', err);
    sendError(res, 'Failed to remove content', 500);
  }
});

// ── GET /flagged-users ────────────────────────────────────────────────────────
//
// Returns users with flagged_for_review=true OR 2+ filter triggers, enriched
// with filterCount, warningCount, disputeLossCount, and a severity score.
// Sorted by severityScore DESC.

interface FlaggedUserRawRow {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; isBanned: boolean; avatarUrl: string | null;
  createdAt: Date;
}

router.get('/flagged-users', async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Users formally flagged for review (new column → raw SQL)
    const formallyFlagged = await prisma.$queryRaw<FlaggedUserRawRow[]>(
      Prisma.sql`
        SELECT id, email, "firstName", "lastName", role::text, "isActive", "isBanned", "avatarUrl", "createdAt"
        FROM   "User"
        WHERE  flagged_for_review = true
      `,
    );
    const formalIds = new Set(formallyFlagged.map(u => u.id));

    // 2. Users with 2+ filter triggers not already in the formal set
    const heavyFilterers = await prisma.conversationMessage.groupBy({
      by:     ['senderId'],
      where:  { isFiltered: true },
      _count: { id: true },
      having: { id: { _count: { gte: 2 } } },
    });
    const extraIds = heavyFilterers.map(r => r.senderId).filter(id => !formalIds.has(id));

    const extraUsers = extraIds.length > 0
      ? await prisma.user.findMany({
          where:  { id: { in: extraIds } },
          select: {
            id: true, email: true, firstName: true, lastName: true,
            role: true, isActive: true, isBanned: true, avatarUrl: true, createdAt: true,
          },
        })
      : [];

    const allUsers = [
      ...formallyFlagged,
      ...extraUsers.map(u => ({ ...u, role: u.role as string })),
    ];

    if (!allUsers.length) {
      sendSuccess(res, { users: [] });
      return;
    }

    const allIds = allUsers.map(u => u.id);

    // 3. Batch: filter trigger counts per user
    const filterGroups = await prisma.conversationMessage.groupBy({
      by:    ['senderId'],
      where: { senderId: { in: allIds }, isFiltered: true },
      _count: { id: true },
    });
    const filterMap = new Map(filterGroups.map(r => [r.senderId, r._count.id]));

    // 4. Batch: warning counts from user_warnings
    const supabase = getServiceClient();
    const { data: warnRows } = await supabase
      .from('user_warnings')
      .select('user_id')
      .in('user_id', allIds);

    const warnMap = new Map<string, number>();
    for (const w of (warnRows ?? []) as { user_id: string }[]) {
      warnMap.set(w.user_id, (warnMap.get(w.user_id) ?? 0) + 1);
    }

    // 5. Batch: dispute losses (filedBy user, ruling went against their role)
    const { data: disputeRows } = await supabase
      .from('disputes')
      .select('filed_by_id, ruling')
      .in('filed_by_id', allIds)
      .not('ruling', 'is', null);

    const roleMap = new Map(allUsers.map(u => [u.id, u.role]));
    const lossMap = new Map<string, number>();
    for (const d of (disputeRows ?? []) as { filed_by_id: string; ruling: string }[]) {
      const role = roleMap.get(d.filed_by_id) ?? '';
      const isLoss =
        (role === 'INVESTOR'   && d.ruling === 'CONTRACTOR_WINS') ||
        (role === 'CONTRACTOR' && d.ruling === 'INVESTOR_WINS');
      if (isLoss) lossMap.set(d.filed_by_id, (lossMap.get(d.filed_by_id) ?? 0) + 1);
    }

    // 6. Compute score + assemble
    const users = allUsers
      .map(u => {
        const filterCount    = filterMap.get(u.id) ?? 0;
        const warningCount   = warnMap.get(u.id) ?? 0;
        const disputeLossCount = lossMap.get(u.id) ?? 0;
        const severityScore  = Math.min(100, filterCount * 5 + warningCount * 15 + disputeLossCount * 10);
        return {
          id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
          role: u.role, isActive: u.isActive, isBanned: u.isBanned, avatarUrl: u.avatarUrl,
          flaggedForReview: formalIds.has(u.id),
          filterCount, warningCount, disputeLossCount, severityScore,
          createdAt: u.createdAt,
        };
      })
      .sort((a, b) => b.severityScore - a.severityScore);

    sendSuccess(res, { users });
  } catch (err) {
    console.error('[admin/moderation] GET /flagged-users error:', err);
    sendError(res, 'Failed to fetch flagged users', 500);
  }
});

// ── POST /users/:userId/warn ──────────────────────────────────────────────────
//
// Issue a direct warning to a user (not tied to a specific message).
// Writes to user_warnings and logs the admin action.

const warnUserBodySchema = z.object({
  reason: z.string().min(5).max(500),
});

router.post('/users/:userId/warn', async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;
  const adminId = req.user!.userId;

  const bodyParsed = warnUserBodySchema.safeParse(req.body);
  if (!bodyParsed.success) {
    sendError(res, bodyParsed.error.issues[0]?.message ?? 'reason required', 400);
    return;
  }
  const { reason } = bodyParsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) { sendError(res, 'User not found', 404); return; }

    const supabase = getServiceClient();
    await supabase.from('user_warnings').insert({
      user_id:  userId,
      admin_id: adminId,
      type:     'DIRECT_WARNING',
      note:     reason,
    });

    void writeAuditLog({
      adminId,
      action:     'USER_WARN',
      targetType: 'user',
      targetId:   userId,
      payload:    { reason },
      ipAddress:  req.ip,
    });

    sendSuccess(res, { warned: true, userId });
  } catch (err) {
    console.error('[admin/moderation] POST /users/:userId/warn error:', err);
    sendError(res, 'Failed to warn user', 500);
  }
});

export default router;
