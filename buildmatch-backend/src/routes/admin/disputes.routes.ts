/**
 * src/routes/admin/disputes.routes.ts  — v2 schema
 *
 * Mounted at: /api/admin/disputes
 * Guards:     authenticate + requireAdmin (applied once in admin/index.ts)
 *
 * GET  /                  — paginated list: oldest OPEN first, then rest
 * GET  /:id               — full detail: dispute + job + parties + messages +
 *                           milestone proof + dispute_notes + escrow
 * POST /:id/note          — add admin-only note (dispute_notes)
 * POST /:id/ruling        — record ruling, trigger Stripe, email both parties
 * POST /:id/request-info  — request info from one party, set UNDER_REVIEW
 * PUT  /:id/status        — change status (admin workflow, preserved from v1)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { getServiceClient } from '../../lib/supabase';
import { writeAuditLog } from '../../services/admin/audit.service';
import { stripe } from '../../services/stripe.service';
import prisma from '../../lib/prisma';

const router = Router();

// ── v2 row types ──────────────────────────────────────────────────────────────

interface DisputeRow {
  id:              string;
  job_id:          string;
  filed_by_id:     string;
  milestone_draw:  number;
  amount_disputed: number;
  reason:          string;
  status:          string;
  ruling:          string | null;
  ruling_note:     string | null;
  ruling_by:       string | null;
  ruling_at:       string | null;
  created_at:      string;
  updated_at:      string;
}

interface DisputeNoteRow {
  id:         string;
  dispute_id: string;
  admin_id:   string;
  content:    string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Days a dispute has been open, computed from created_at. */
function daysOpen(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

/**
 * Derive both parties for a v2 dispute (no against_id column).
 * Returns { investorId, contractorId } from job + accepted bid.
 */
async function deriveParties(jobId: string) {
  const [job, bid] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId }, select: { investorId: true } }),
    prisma.bid.findFirst({ where: { jobId, status: 'ACCEPTED' }, select: { contractorId: true } }),
  ]);
  return {
    investorId:   job?.investorId   ?? null,
    contractorId: bid?.contractorId ?? null,
  };
}

/** Other-party of the filer: if filer is investor → contractor, else → investor. */
async function otherPartyId(disputeRow: DisputeRow): Promise<string | null> {
  const { investorId, contractorId } = await deriveParties(disputeRow.job_id);
  if (disputeRow.filed_by_id === investorId) return contractorId;
  if (disputeRow.filed_by_id === contractorId) return investorId;
  return investorId ?? null; // fallback
}

/** Fetch the Stripe Express account ID for a contractor. */
async function contractorStripeAccountId(contractorId: string): Promise<string> {
  const acct = await prisma.contractorStripeAccount.findUnique({
    where: { userId: contractorId },
  });
  if (!acct || !acct.chargesEnabled) {
    throw new AppError('Contractor has not completed Stripe onboarding', 422);
  }
  return acct.stripeAccountId;
}

/** Fire-and-forget email delivery (wire in Resend/SendGrid here). */
function deliverEmail(opts: { to: string; subject: string; html: string }): void {
  console.log(`[admin-disputes] email → ${opts.to} | ${opts.subject}`);
}

const SITE_URL = (process.env.FRONTEND_URL ?? 'https://buildmatch.com').replace(/\/$/, '');

/** Ruling notification email — sent to both parties. */
async function sendRulingEmail(params: {
  userId:     string;
  jobTitle:   string;
  disputeId:  string;
  ruling:     string;
  splitPct:   number | null;
  rulingNote: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: params.userId },
    select: { email: true, firstName: true },
  });
  if (!user?.email) return;

  const rulingLabels: Record<string, string> = {
    INVESTOR:   'resolved in favour of the investor — funds have been returned',
    CONTRACTOR: 'resolved in favour of the contractor — funds have been released',
    SPLIT:      `resolved with a ${params.splitPct ?? 50}/${100 - (params.splitPct ?? 50)} split between parties`,
    WITHDRAWN:  'closed as withdrawn',
  };
  const label = rulingLabels[params.ruling] ?? params.ruling;

  deliverEmail({
    to:      user.email,
    subject: `Dispute resolved: ${params.jobTitle}`,
    html: `
      <p>Hi ${user.firstName},</p>
      <p>The dispute on <strong>${params.jobTitle}</strong> has been ${label}.</p>
      ${params.rulingNote ? `<p><strong>Ruling note:</strong> ${params.rulingNote}</p>` : ''}
      <p><a href="${SITE_URL}/dashboard/settings/disputes/${params.disputeId}">View dispute</a></p>
    `,
  });
}

/** Request-info notification email — sent to the targeted party. */
async function sendRequestInfoEmail(params: {
  userId:     string;
  jobTitle:   string;
  disputeId:  string;
  message:    string;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: params.userId },
    select: { email: true, firstName: true },
  });
  if (!user?.email) return;

  deliverEmail({
    to:      user.email,
    subject: `Information requested — dispute: ${params.jobTitle}`,
    html: `
      <p>Hi ${user.firstName},</p>
      <p>BuildMatch has requested information from you regarding the dispute on
         <strong>${params.jobTitle}</strong>.</p>
      <p><strong>Message:</strong> ${params.message}</p>
      <p>Please respond promptly.
         <a href="${SITE_URL}/dashboard/settings/disputes/${params.disputeId}">View dispute</a></p>
    `,
  });
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const V2_STATUSES = [
  'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED',
] as const;

const listQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(25),
  status:   z.enum(V2_STATUSES).optional(),
  dateFrom: z.string().optional(),
  dateTo:   z.string().optional(),
  jobId:    z.string().optional(),
  userId:   z.string().optional(),
});

const noteSchema = z.object({
  content: z.string().min(1).max(5000),
});

const RULING_VALUES = ['INVESTOR', 'CONTRACTOR', 'SPLIT', 'WITHDRAWN'] as const;

const rulingSchema = z.object({
  ruling:     z.enum(RULING_VALUES),
  splitPct:   z.number().int().min(1).max(99).optional(),
  rulingNote: z.string().min(50).max(2000),
}).refine(
  d => d.ruling !== 'SPLIT' || (d.splitPct !== undefined),
  { message: 'splitPct (1–99) is required for SPLIT rulings' },
);

const requestInfoSchema = z.object({
  targetUserId: z.string().min(1),
  message:      z.string().min(10).max(2000),
});

const adminStatusSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'CLOSED'] as const),
  note:   z.string().max(2000).optional(),
});

// ── GET / ─────────────────────────────────────────────────────────────────────
// Returns disputes enriched with job title, party names, days_open, note_count.
// Default sort: oldest OPEN first, then other statuses by created_at ASC.

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  const { page, limit, status, dateFrom, dateTo, jobId, userId } = parsed.data;

  try {
    const supabase = getServiceClient();

    // Build filter query — fetch all matching rows for JS sort + pagination
    let query = supabase.from('disputes').select('*', { count: 'exact' });

    if (status)   query = query.eq('status',  status);
    if (jobId)    query = query.eq('job_id',  jobId);
    if (userId)   query = query.eq('filed_by_id', userId);
    if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
    if (dateTo)   query = query.lte('created_at', new Date(dateTo).toISOString());

    const { data, error, count } = await query;
    if (error) throw new AppError('Failed to fetch disputes', 500);

    const rows  = (data ?? []) as DisputeRow[];
    const total = count ?? rows.length;

    // Sort: OPEN rows first (ASC by created_at), then the rest (ASC by created_at)
    const sorted = [
      ...rows.filter(r => r.status === 'OPEN')
             .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      ...rows.filter(r => r.status !== 'OPEN')
             .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    ];

    // Apply pagination over sorted list
    const paged = sorted.slice((page - 1) * limit, page * limit);

    if (!paged.length) {
      sendSuccess(res, { data: [], total, page, totalPages: Math.ceil(total / limit), limit });
      return;
    }

    // Batch enrich: job titles + party names
    const jobIds  = [...new Set(paged.map(r => r.job_id))];
    const filerIds = [...new Set(paged.map(r => r.filed_by_id))];

    // Fetch jobs + filers + accepted bids (to get contractors) in parallel
    const [jobs, filerUsers, acceptedBids] = await Promise.all([
      prisma.job.findMany({
        where:  { id: { in: jobIds } },
        select: { id: true, title: true, investorId: true },
      }),
      prisma.user.findMany({
        where:  { id: { in: filerIds } },
        select: { id: true, firstName: true, lastName: true },
      }),
      prisma.bid.findMany({
        where:  { jobId: { in: jobIds }, status: 'ACCEPTED' },
        select: { jobId: true, contractorId: true },
      }),
    ]);

    const jobMap        = new Map(jobs.map(j => [j.id, j]));
    const filerMap      = new Map(filerUsers.map(u => [u.id, `${u.firstName} ${u.lastName}`]));
    const bidByJob      = new Map(acceptedBids.map(b => [b.jobId, b.contractorId]));

    // Collect all "other party" IDs for a single user lookup
    const otherPartyIds = paged.map(r => {
      const job = jobMap.get(r.job_id);
      if (!job) return null;
      return r.filed_by_id === job.investorId
        ? (bidByJob.get(r.job_id) ?? null)
        : job.investorId;
    });

    const otherIds = [...new Set(otherPartyIds.filter(Boolean) as string[])];
    const otherUsers = otherIds.length > 0
      ? await prisma.user.findMany({
          where:  { id: { in: otherIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const otherMap = new Map(otherUsers.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    // Batch note counts from dispute_notes
    const disputeIds = paged.map(r => r.id);
    const { data: notesData } = await supabase
      .from('dispute_notes')
      .select('dispute_id')
      .in('dispute_id', disputeIds);
    const noteCountMap = new Map<string, number>();
    for (const n of (notesData ?? []) as { dispute_id: string }[]) {
      noteCountMap.set(n.dispute_id, (noteCountMap.get(n.dispute_id) ?? 0) + 1);
    }

    sendSuccess(res, {
      data: paged.map((r, i) => ({
        id:             r.id,
        jobId:          r.job_id,
        jobTitle:       jobMap.get(r.job_id)?.title ?? '',
        filedById:      r.filed_by_id,
        filedByName:    filerMap.get(r.filed_by_id) ?? '',
        otherPartyId:   otherPartyIds[i],
        otherPartyName: otherPartyIds[i] ? (otherMap.get(otherPartyIds[i]!) ?? '') : '',
        milestoneDraw:  r.milestone_draw,
        amountDisputed: Number(r.amount_disputed),
        status:         r.status,
        daysOpen:       daysOpen(r.created_at),
        noteCount:      noteCountMap.get(r.id) ?? 0,
        createdAt:      r.created_at,
        updatedAt:      r.updated_at,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/disputes] GET / error:', err);
    sendError(res, 'Failed to fetch disputes', 500);
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────────────
// Full detail: dispute + job + investor/contractor profiles + conversation thread
// + milestone proof + dispute_notes + escrow.

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const supabase = getServiceClient();

    // 1. Fetch dispute row
    const { data: dr, error: drErr } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', id)
      .single();
    if (drErr || !dr) { sendError(res, 'Dispute not found', 404); return; }
    const row = dr as DisputeRow;

    // 2. Derive parties
    const { investorId, contractorId } = await deriveParties(row.job_id);

    // 3. Fetch job, parties, conversation, escrow, dispute_notes in parallel
    const [
      job,
      investorUser,
      contractorUser,
      investorProfile,
      contractorProfile,
      conversations,
      escrow,
      notesResult,
    ] = await Promise.all([
      prisma.job.findUnique({
        where:  { id: row.job_id },
        select: {
          id: true, title: true, description: true, tradeType: true,
          budgetMin: true, budgetMax: true, city: true, state: true,
          status: true, photos: true, createdAt: true,
        },
      }),

      investorId
        ? prisma.user.findUnique({
            where:  { id: investorId },
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, createdAt: true },
          })
        : Promise.resolve(null),

      contractorId
        ? prisma.user.findUnique({
            where:  { id: contractorId },
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, createdAt: true },
          })
        : Promise.resolve(null),

      investorId
        ? prisma.contractorProfile.findUnique({
            where:  { userId: investorId },
            select: { id: true, specialties: true, averageRating: true, completedJobs: true },
          }).catch(() => null)
        : Promise.resolve(null),

      contractorId
        ? prisma.contractorProfile.findUnique({
            where:  { userId: contractorId },
            select: {
              id: true, specialties: true, averageRating: true, completedJobs: true,
              yearsExperience: true, isLicenseVerified: true, reliabilityScore: true,
            },
          })
        : Promise.resolve(null),

      // Conversation messages: find conversation for this job, fetch all messages
      prisma.conversation.findFirst({
        where: { jobId: row.job_id },
        include: {
          convMessages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true, senderId: true, content: true,
              isFiltered: true, createdAt: true,
            },
          },
        },
      }),

      // Escrow + milestones
      prisma.escrowPayment.findUnique({
        where:   { jobId: row.job_id },
        include: { milestones: { orderBy: { order: 'asc' } } },
      }),

      // Dispute notes (admin-only)
      supabase
        .from('dispute_notes')
        .select('*')
        .eq('dispute_id', id)
        .order('created_at', { ascending: true }),
    ]);

    // 4. Find the disputed milestone by order
    const disputedMilestone = escrow?.milestones.find(m => m.order === row.milestone_draw) ?? null;

    // 5. Batch sender name lookup for conversation messages
    const senderIds = [...new Set(conversations?.convMessages.map(m => m.senderId) ?? [])];
    const senders   = senderIds.length > 0
      ? await prisma.user.findMany({
          where:  { id: { in: senderIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const senderMap = new Map(senders.map(u => [u.id, `${u.firstName} ${u.lastName}`]));

    // 6. Batch admin name lookup for dispute notes
    const notes     = (notesResult.data ?? []) as DisputeNoteRow[];
    const adminIds  = [...new Set(notes.map(n => n.admin_id))];
    const admins    = adminIds.length > 0
      ? await prisma.user.findMany({
          where:  { id: { in: adminIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const adminMap = new Map(admins.map(a => [a.id, `${a.firstName} ${a.lastName}`]));

    sendSuccess(res, {
      dispute: {
        id:             row.id,
        jobId:          row.job_id,
        filedById:      row.filed_by_id,
        milestoneDraw:  row.milestone_draw,
        amountDisputed: Number(row.amount_disputed),
        reason:         row.reason,
        status:         row.status,
        ruling:         row.ruling,
        rulingNote:     row.ruling_note,
        rulingBy:       row.ruling_by,
        rulingAt:       row.ruling_at,
        daysOpen:       daysOpen(row.created_at),
        createdAt:      row.created_at,
        updatedAt:      row.updated_at,
      },

      job: job ? {
        id:          job.id,
        title:       job.title,
        description: job.description,
        tradeType:   job.tradeType,
        budgetMin:   job.budgetMin,
        budgetMax:   job.budgetMax,
        city:        job.city,
        state:       job.state,
        status:      job.status,
        photos:      job.photos ?? [],
        createdAt:   job.createdAt,
      } : null,

      investor: investorUser ? {
        id:        investorUser.id,
        firstName: investorUser.firstName,
        lastName:  investorUser.lastName,
        email:     investorUser.email,
        avatarUrl: investorUser.avatarUrl,
        joinedAt:  investorUser.createdAt,
        profile:   investorProfile ?? null,
      } : null,

      contractor: contractorUser ? {
        id:        contractorUser.id,
        firstName: contractorUser.firstName,
        lastName:  contractorUser.lastName,
        email:     contractorUser.email,
        avatarUrl: contractorUser.avatarUrl,
        joinedAt:  contractorUser.createdAt,
        profile:   contractorProfile ?? null,
      } : null,

      // Full conversation thread between investor and contractor on this job
      messages: (conversations?.convMessages ?? []).map(m => ({
        id:         m.id,
        senderId:   m.senderId,
        senderName: senderMap.get(m.senderId) ?? '',
        content:    m.isFiltered ? '[message filtered]' : m.content,
        isFiltered: m.isFiltered,
        createdAt:  m.createdAt,
      })),

      // Disputed milestone detail + proof
      milestone: disputedMilestone ? {
        id:              disputedMilestone.id,
        order:           disputedMilestone.order,
        title:           disputedMilestone.title,
        description:     disputedMilestone.description ?? null,
        amount:          disputedMilestone.amount,
        percentage:      disputedMilestone.percentage,
        status:          disputedMilestone.status,
        completionNotes: disputedMilestone.completionNotes ?? null,
        disputeReason:   disputedMilestone.disputeReason ?? null,
        approvedAt:      disputedMilestone.approvedAt,
        releasedAt:      disputedMilestone.releasedAt,
      } : null,

      // Admin-only notes
      notes: notes.map(n => ({
        id:        n.id,
        adminId:   n.admin_id,
        adminName: adminMap.get(n.admin_id) ?? '',
        content:   n.content,
        createdAt: n.created_at,
      })),

      // Escrow summary
      escrow: escrow ? {
        id:              escrow.id,
        totalAmount:     escrow.totalAmount,
        platformFee:     escrow.platformFeeAmount,
        status:          escrow.status,
        stripePaymentId: escrow.stripePaymentIntentId,
        milestones:      escrow.milestones.map(m => ({
          id:         m.id,
          order:      m.order,
          title:      m.title,
          amount:     m.amount,
          percentage: m.percentage,
          status:     m.status,
        })),
      } : null,
    });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/disputes] GET /:id error:', err);
    sendError(res, 'Failed to fetch dispute detail', 500);
  }
});

// ── POST /:id/note ─────────────────────────────────────────────────────────────
// Insert an admin-only note into dispute_notes. Never visible to parties.

router.post('/:id/note', async (req: Request, res: Response): Promise<void> => {
  const { id }    = req.params;
  const adminId   = req.user!.userId;

  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  const { content } = parsed.data;

  try {
    const supabase = getServiceClient();

    // Verify dispute exists
    const { data: dr, error: drErr } = await supabase
      .from('disputes')
      .select('id')
      .eq('id', id)
      .single();
    if (drErr || !dr) { sendError(res, 'Dispute not found', 404); return; }

    const { data: inserted, error: insertErr } = await supabase
      .from('dispute_notes')
      .insert({ dispute_id: id, admin_id: adminId, content })
      .select()
      .single();
    if (insertErr || !inserted) throw new AppError('Failed to insert note', 500);

    void writeAuditLog({
      adminId,
      action:     'DISPUTE_NOTE',
      targetType: 'dispute',
      targetId:   id,
      payload:    { contentLength: content.length },
      ipAddress:  req.ip,
    });

    const note = inserted as DisputeNoteRow;
    const admin = await prisma.user.findUnique({
      where:  { id: adminId },
      select: { firstName: true, lastName: true },
    });

    sendSuccess(res, {
      id:        note.id,
      adminId:   note.admin_id,
      adminName: admin ? `${admin.firstName} ${admin.lastName}` : '',
      content:   note.content,
      createdAt: note.created_at,
    }, 'Note added');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/disputes] POST /:id/note error:', err);
    sendError(res, 'Failed to add note', 500);
  }
});

// ── POST /:id/ruling ──────────────────────────────────────────────────────────
// Record ruling, trigger Stripe fund release/refund/split, email both parties.

router.post('/:id/ruling', async (req: Request, res: Response): Promise<void> => {
  const { id }  = req.params;
  const adminId = req.user!.userId;

  const parsed = rulingSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  const { ruling, splitPct, rulingNote } = parsed.data;

  try {
    const supabase = getServiceClient();

    // 1. Load dispute
    const { data: dr, error: drErr } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', id)
      .single();
    if (drErr || !dr) { sendError(res, 'Dispute not found', 404); return; }

    const row = dr as DisputeRow;
    if (row.status === 'RESOLVED') { sendError(res, 'Dispute is already resolved', 409); return; }
    if (row.status === 'CLOSED')   { sendError(res, 'Cannot rule on a closed dispute', 400); return; }

    // 2. Load escrow + find disputed milestone
    const escrow = await prisma.escrowPayment.findUnique({
      where:   { jobId: row.job_id },
      include: { milestones: true },
    });
    if (!escrow) throw new AppError('No escrow found for this job', 422);
    if (!escrow.stripePaymentIntentId) throw new AppError('Escrow has no Stripe payment intent', 422);

    const milestone = escrow.milestones.find(m => m.order === row.milestone_draw);
    if (!milestone) throw new AppError(`Milestone draw #${row.milestone_draw} not found`, 422);

    // 3. Stripe fund movement
    const { contractorId } = await deriveParties(row.job_id);
    const milestoneAmountCents = Math.round(milestone.amount * 100);

    if (ruling === 'INVESTOR') {
      // Full refund to investor
      await stripe.refunds.create({
        payment_intent: escrow.stripePaymentIntentId,
        amount:         milestoneAmountCents,
        metadata:       { disputeId: id, adminId, reason: 'admin_ruling_investor' },
      });
      await prisma.milestone.update({
        where: { id: milestone.id },
        data:  { status: 'RELEASED', releasedAt: new Date(), disputeReason: null },
      });

    } else if (ruling === 'CONTRACTOR') {
      // Full release to contractor
      if (!contractorId) throw new AppError('No contractor found for this job', 422);
      const stripeAcctId = await contractorStripeAccountId(contractorId);
      const transfer = await stripe.transfers.create({
        amount:         milestoneAmountCents,
        currency:       'usd',
        destination:    stripeAcctId,
        transfer_group: escrow.id,
        metadata:       { disputeId: id, adminId, reason: 'admin_ruling_contractor' },
      });
      await prisma.milestone.update({
        where: { id: milestone.id },
        data:  {
          status:           'APPROVED',
          approvedAt:       new Date(),
          stripeTransferId: transfer.id,
          disputeReason:    null,
        },
      });

    } else if (ruling === 'SPLIT') {
      // splitPct% to contractor, remainder to investor
      if (!contractorId) throw new AppError('No contractor found for this job', 422);
      const pct            = splitPct!;
      const contractorCents = Math.round(milestoneAmountCents * (pct / 100));
      const investorCents   = milestoneAmountCents - contractorCents;

      const stripeAcctId = await contractorStripeAccountId(contractorId);

      // Transfer first — if this fails we have not yet refunded
      const transfer = await stripe.transfers.create({
        amount:         contractorCents,
        currency:       'usd',
        destination:    stripeAcctId,
        transfer_group: escrow.id,
        metadata:       { disputeId: id, adminId, reason: 'admin_ruling_split_contractor', pct: String(pct) },
      });

      await stripe.refunds.create({
        payment_intent: escrow.stripePaymentIntentId,
        amount:         investorCents,
        metadata:       { disputeId: id, adminId, reason: 'admin_ruling_split_investor', pct: String(100 - pct) },
      });

      await prisma.milestone.update({
        where: { id: milestone.id },
        data:  {
          status:           'RELEASED',
          releasedAt:       new Date(),
          stripeTransferId: transfer.id,
          disputeReason:    null,
        },
      });
    }
    // WITHDRAWN ruling: no Stripe movement; just mark resolved

    // 4. Update escrow status
    const allMilestones = await prisma.milestone.findMany({ where: { escrowPaymentId: escrow.id } });
    const allDone = allMilestones.every(m =>
      m.id === milestone.id ? true : ['APPROVED', 'RELEASED', 'REFUNDED'].includes(m.status),
    );
    await prisma.escrowPayment.update({
      where: { id: escrow.id },
      data:  { status: allDone ? 'FULLY_RELEASED' : 'IN_PROGRESS' },
    });

    // 5. Update dispute: set RESOLVED + ruling fields
    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('disputes')
      .update({
        status:     'RESOLVED',
        ruling,
        ruling_note: rulingNote,
        ruling_by:   adminId,
        ruling_at:   now,
        updated_at:  now,
      })
      .eq('id', id);
    if (updateErr) throw new AppError('Failed to update dispute', 500);

    // 5b. Draw request callback — update DrawMilestone/DrawRequest if this
    //     dispute is linked to one (non-fatal: never block the ruling response)
    try {
      const drawReq = await prisma.drawRequest.findFirst({
        where:  { disputeId: id },
        select: { id: true, milestoneId: true },
      });
      if (drawReq) {
        if (ruling === 'CONTRACTOR' || ruling === 'SPLIT') {
          await prisma.$transaction([
            prisma.drawRequest.update({
              where: { id: drawReq.id },
              data:  { status: 'APPROVED' },
            }),
            prisma.drawMilestone.update({
              where: { id: drawReq.milestoneId },
              data:  { status: 'RELEASED', approvedAt: new Date(), releasedAt: new Date() },
            }),
          ]);
        } else if (ruling === 'INVESTOR') {
          await prisma.$transaction([
            prisma.drawRequest.update({
              where: { id: drawReq.id },
              data:  {
                status:          'REJECTED',
                rejectionReason: rulingNote ?? 'Dispute resolved in investor\'s favor',
              },
            }),
            prisma.drawMilestone.update({
              where: { id: drawReq.milestoneId },
              data:  { status: 'PENDING' },
            }),
          ]);
        }
        // WITHDRAWN: no draw state change
      }
    } catch (drawErr) {
      console.error('[admin/disputes] draw request callback error:', drawErr);
    }

    // 6. Audit log (non-fatal)
    void writeAuditLog({
      adminId,
      action:     'DISPUTE_RULING',
      targetType: 'dispute',
      targetId:   id,
      payload:    { ruling, splitPct: splitPct ?? null, rulingNote, previousStatus: row.status },
      ipAddress:  req.ip,
    });

    // 7. Email both parties — fire-and-forget
    const job = await prisma.job.findUnique({
      where:  { id: row.job_id },
      select: { title: true },
    });
    const jobTitle = job?.title ?? 'your job';
    const { investorId } = await deriveParties(row.job_id);

    void Promise.all([
      investorId   ? sendRulingEmail({ userId: investorId,   jobTitle, disputeId: id, ruling, splitPct: splitPct ?? null, rulingNote }) : Promise.resolve(),
      contractorId ? sendRulingEmail({ userId: contractorId, jobTitle, disputeId: id, ruling, splitPct: splitPct ?? null, rulingNote }) : Promise.resolve(),
    ]).catch(console.error);

    sendSuccess(res, {
      id:        id,
      status:    'RESOLVED',
      ruling,
      rulingNote,
      rulingBy:  adminId,
      rulingAt:  now,
    }, 'Dispute resolved');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/disputes] POST /:id/ruling error:', err);
    sendError(res, 'Failed to record ruling', 500);
  }
});

// ── POST /:id/request-info ────────────────────────────────────────────────────
// Send an information request to one party; set status → UNDER_REVIEW.
// Stores the request in dispute_notes (admin record) and emails the target.

router.post('/:id/request-info', async (req: Request, res: Response): Promise<void> => {
  const { id }  = req.params;
  const adminId = req.user!.userId;

  const parsed = requestInfoSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  const { targetUserId, message } = parsed.data;

  try {
    const supabase = getServiceClient();

    // 1. Load dispute
    const { data: dr, error: drErr } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', id)
      .single();
    if (drErr || !dr) { sendError(res, 'Dispute not found', 404); return; }
    const row = dr as DisputeRow;

    if (['RESOLVED', 'CLOSED'].includes(row.status)) {
      sendError(res, `Cannot request information on a ${row.status.toLowerCase()} dispute`, 400);
      return;
    }

    // 2. Verify targetUserId is a party to this dispute
    const { investorId, contractorId } = await deriveParties(row.job_id);
    const validPartyIds = [
      row.filed_by_id,
      investorId,
      contractorId,
    ].filter(Boolean) as string[];

    if (!validPartyIds.includes(targetUserId)) {
      sendError(res, 'targetUserId is not a party to this dispute', 400);
      return;
    }

    // 3. Set status to UNDER_REVIEW if not already
    const now = new Date().toISOString();
    if (row.status !== 'UNDER_REVIEW') {
      const { error: statusErr } = await supabase
        .from('disputes')
        .update({ status: 'UNDER_REVIEW', updated_at: now })
        .eq('id', id);
      if (statusErr) throw new AppError('Failed to update dispute status', 500);
    }

    // 4. Store admin note (request record)
    const noteContent = `[Info request → ${targetUserId}] ${message}`;
    await supabase
      .from('dispute_notes')
      .insert({ dispute_id: id, admin_id: adminId, content: noteContent });

    // 5. Audit log (non-fatal)
    void writeAuditLog({
      adminId,
      action:     'DISPUTE_NOTE',
      targetType: 'dispute',
      targetId:   id,
      payload:    { type: 'request_info', targetUserId },
      ipAddress:  req.ip,
    });

    // 6. Email the targeted party — fire-and-forget
    const job = await prisma.job.findUnique({
      where:  { id: row.job_id },
      select: { title: true },
    });
    void sendRequestInfoEmail({
      userId:    targetUserId,
      jobTitle:  job?.title ?? 'your job',
      disputeId: id,
      message,
    }).catch(console.error);

    sendSuccess(res, {
      disputeId: id,
      status:    'UNDER_REVIEW',
      targetUserId,
    }, 'Information request sent');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/disputes] POST /:id/request-info error:', err);
    sendError(res, 'Failed to send information request', 500);
  }
});

// ── PUT /:id/status ───────────────────────────────────────────────────────────
// Admin workflow status change (no Stripe side-effects).

router.put('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const { id }  = req.params;
  const adminId = req.user!.userId;

  const parsed = adminStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid body', 400);
    return;
  }
  const { status, note } = parsed.data;

  try {
    const supabase = getServiceClient();

    const { data: dr, error: drErr } = await supabase
      .from('disputes')
      .select('id, status')
      .eq('id', id)
      .single();
    if (drErr || !dr) { sendError(res, 'Dispute not found', 404); return; }

    const existing = dr as { id: string; status: string };
    if (existing.status === status) {
      sendError(res, `Dispute is already ${status}`, 400);
      return;
    }
    if (['RESOLVED', 'CLOSED'].includes(existing.status)) {
      sendError(res, `Cannot change status of a ${existing.status.toLowerCase()} dispute`, 400);
      return;
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('disputes')
      .update({ status, updated_at: now })
      .eq('id', id);
    if (updateErr) throw new AppError('Failed to update status', 500);

    // Store admin note if provided
    if (note) {
      await supabase.from('dispute_notes').insert({
        dispute_id: id,
        admin_id:   adminId,
        content:    `[Status → ${status}] ${note}`,
      });
    }

    void writeAuditLog({
      adminId,
      action:     status === 'CLOSED' ? 'DISPUTE_CLOSE' : 'DISPUTE_NOTE',
      targetType: 'dispute',
      targetId:   id,
      payload:    { status, previousStatus: existing.status },
      ipAddress:  req.ip,
      note,
    });

    sendSuccess(res, { id, status, updatedAt: now }, `Status updated to ${status}`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/disputes] PUT /:id/status error:', err);
    sendError(res, 'Failed to update status', 500);
  }
});

export default router;
