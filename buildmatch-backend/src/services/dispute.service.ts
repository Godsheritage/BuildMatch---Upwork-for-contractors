import prisma from '../lib/prisma';
import { getServiceClient } from '../lib/supabase';
import { AppError } from '../utils/app-error';
import type {
  Dispute,
  DisputeEvidence,
  DisputeMessage,
  DisputeStatus,
  EvidenceType,
  FileDisputeInput,
} from '../types/dispute.types';
import {
  notifyDisputeFiled,
  notifyNewDisputeMessage,
  notifyDisputeWithdrawn,
} from './dispute-notifications.service';

// ── Raw Supabase row shapes ───────────────────────────────────────────────────

interface DisputeRow {
  id:               string;
  job_id:           string;
  filed_by_id:      string;
  against_id:       string;
  milestone_draw:   number | null;
  amount_disputed:  number;
  category:         string;
  description:      string;
  desired_outcome:  string;
  status:           string;
  ruling:           string | null;
  ruling_note:      string | null;
  resolved_at:      string | null;
  last_activity_at: string;
  created_at:       string;
}

interface DisputeMessageRow {
  id:         string;
  dispute_id: string;
  sender_id:  string;
  content:    string;
  is_system:  boolean;
  created_at: string;
}

interface DisputeEvidenceRow {
  id:           string;
  dispute_id:   string;
  submitted_by: string;
  type:         string;
  url:          string | null;
  description:  string;
  created_at:   string;
}

// (message notification debounce is handled in dispute-notifications.service.ts)

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertParty(disputeId: string, userId: string): Promise<DisputeRow> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single();

  if (error || !data) throw new AppError('Dispute not found', 404);
  const row = data as DisputeRow;
  if (row.filed_by_id !== userId && row.against_id !== userId) {
    throw new AppError('Access denied', 403);
  }
  return row;
}

function isActive(status: string): boolean {
  return !['RESOLVED', 'CLOSED', 'WITHDRAWN'].includes(status);
}

async function fetchUserMeta(id: string) {
  const u = await prisma.user.findUnique({
    where:  { id },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
  });
  if (!u) throw new AppError(`User ${id} not found`, 404);
  return {
    id:        u.id,
    firstName: u.firstName,
    lastName:  u.lastName,
    avatarUrl: u.avatarUrl ?? null,
    role:      u.role as string,
  };
}

async function countRows(table: string, column: string, id: string): Promise<number> {
  const { count, error } = await getServiceClient()
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, id);
  return error ? 0 : (count ?? 0);
}

async function buildDispute(row: DisputeRow): Promise<Dispute> {
  const job = await prisma.job.findUnique({
    where:  { id: row.job_id },
    select: { title: true },
  });
  const [filedBy, against, evidenceCount, messageCount] = await Promise.all([
    fetchUserMeta(row.filed_by_id),
    fetchUserMeta(row.against_id),
    countRows('dispute_evidence', 'dispute_id', row.id),
    countRows('dispute_messages', 'dispute_id', row.id),
  ]);

  return {
    id:             row.id,
    jobId:          row.job_id,
    jobTitle:       job?.title ?? '',
    filedById:      row.filed_by_id,
    againstId:      row.against_id,
    milestoneDraw:  row.milestone_draw,
    amountDisputed: Number(row.amount_disputed),
    category:       row.category as Dispute['category'],
    description:    row.description,
    desiredOutcome: row.desired_outcome,
    status:         row.status as DisputeStatus,
    ruling:         row.ruling as Dispute['ruling'],
    rulingNote:     row.ruling_note,
    resolvedAt:     row.resolved_at,
    lastActivityAt: row.last_activity_at,
    createdAt:      row.created_at,
    filedBy,
    against,
    evidenceCount,
    messageCount,
  };
}

// ── fileDispute ───────────────────────────────────────────────────────────────

export async function fileDispute(
  input: FileDisputeInput,
  filedById: string,
): Promise<Dispute> {
  const supabase = getServiceClient();

  // 1. Fetch and validate the job
  const job = await prisma.job.findUnique({
    where:  { id: input.jobId },
    select: { id: true, title: true, status: true, investorId: true },
  });
  if (!job) throw new AppError('Job not found', 404);
  if (!['IN_PROGRESS', 'AWARDED'].includes(job.status)) {
    throw new AppError('Disputes can only be filed on active jobs', 400);
  }

  // 2. Find the accepted bid to get the assigned contractor
  const acceptedBid = await prisma.bid.findFirst({
    where:  { jobId: input.jobId, status: 'ACCEPTED' },
    select: { contractorId: true },
  });
  const contractorId = acceptedBid?.contractorId ?? null;

  // 3. Verify the filer is a party and determine against_id
  const isInvestor   = filedById === job.investorId;
  const isContractor = contractorId !== null && filedById === contractorId;
  if (!isInvestor && !isContractor) {
    throw new AppError('You are not a party to this job', 403);
  }
  const againstId = isInvestor ? contractorId! : job.investorId;

  // 4. Check for an existing open dispute by this user on this job
  const { data: existing } = await supabase
    .from('disputes')
    .select('id')
    .eq('job_id', input.jobId)
    .eq('filed_by_id', filedById)
    .in('status', ['OPEN', 'UNDER_REVIEW'])
    .maybeSingle();
  if (existing) {
    throw new AppError('You already have an open dispute on this job', 400);
  }

  // 5. Validate milestoneDraw if provided
  if (input.milestoneDraw !== undefined) {
    const escrow = await prisma.escrowPayment.findUnique({
      where:   { jobId: input.jobId },
      include: { milestones: { select: { order: true } } },
    });
    const validDraws = escrow?.milestones.map((m) => m.order) ?? [];
    if (!validDraws.includes(input.milestoneDraw)) {
      throw new AppError(
        `Invalid milestoneDraw. Valid draw numbers: ${validDraws.join(', ')}`,
        400,
      );
    }
  }

  // Insert the dispute
  const { data: inserted, error: insertErr } = await supabase
    .from('disputes')
    .insert({
      job_id:          input.jobId,
      filed_by_id:     filedById,
      against_id:      againstId,
      milestone_draw:  input.milestoneDraw ?? null,
      amount_disputed: input.amountDisputed,
      category:        input.category,
      description:     input.description,
      desired_outcome: input.desiredOutcome,
      status:          'OPEN',
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (insertErr || !inserted) {
    throw new AppError('Failed to file dispute', 500);
  }
  const disputeRow = inserted as DisputeRow;

  // Insert system message
  const filer = await fetchUserMeta(filedById);
  await supabase.from('dispute_messages').insert({
    dispute_id: disputeRow.id,
    sender_id:  filedById,
    content:    `Dispute filed by ${filer.firstName}. BuildMatch will review within 2 business days. Both parties may submit evidence.`,
    is_system:  true,
  });

  // Build dispute record first so the notification has the full object
  const built = await buildDispute(disputeRow);

  // Fetch emails for both parties (fire-and-forget — do not block the response)
  Promise.all([
    prisma.user.findUnique({ where: { id: filedById }, select: { email: true } }),
    prisma.user.findUnique({ where: { id: againstId }, select: { email: true } }),
    fetchUserMeta(againstId),
  ]).then(([filerRecord, againstRecord, opponent]) => {
    notifyDisputeFiled({
      dispute:     built,
      filedByUser: { id: filedById, firstName: filer.firstName, lastName: filer.lastName, email: filerRecord?.email ?? '' },
      againstUser: { id: againstId, firstName: opponent.firstName, lastName: opponent.lastName, email: againstRecord?.email ?? '' },
      job:         { id: job.id, title: job.title },
    });
  }).catch(console.error);

  return built;
}

// ── getUserDisputes ───────────────────────────────────────────────────────────

export async function getUserDisputes(
  userId: string,
  filters: { status?: DisputeStatus; page: number; limit: number },
): Promise<{ disputes: Dispute[]; total: number; page: number; totalPages: number }> {
  const supabase = getServiceClient();
  const offset   = (filters.page - 1) * filters.limit;

  let query = supabase
    .from('disputes')
    .select('*', { count: 'exact' })
    .or(`filed_by_id.eq.${userId},against_id.eq.${userId}`)
    .order('last_activity_at', { ascending: false })
    .range(offset, offset + filters.limit - 1);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error, count } = await query;
  if (error) throw new AppError('Failed to fetch disputes', 500);

  const rows     = (data ?? []) as DisputeRow[];
  const total    = count ?? 0;
  const disputes = await Promise.all(rows.map(buildDispute));

  return {
    disputes,
    total,
    page:       filters.page,
    totalPages: Math.ceil(total / filters.limit),
  };
}

// ── getDisputeById ────────────────────────────────────────────────────────────

export async function getDisputeById(
  disputeId: string,
  requesterId: string,
): Promise<Dispute> {
  const row = await assertParty(disputeId, requesterId);
  return buildDispute(row);
}

// ── getDisputeMessages ────────────────────────────────────────────────────────

export async function getDisputeMessages(
  disputeId: string,
  requesterId: string,
): Promise<DisputeMessage[]> {
  await assertParty(disputeId, requesterId);

  const { data, error } = await getServiceClient()
    .from('dispute_messages')
    .select('*')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });

  if (error) throw new AppError('Failed to fetch messages', 500);

  const rows = (data ?? []) as DisputeMessageRow[];

  // Batch-fetch unique senders
  const senderIds = [...new Set(rows.map((r) => r.sender_id))];
  const senders   = await prisma.user.findMany({
    where:  { id: { in: senderIds } },
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  });
  const senderMap = new Map(senders.map((u) => [u.id, u]));

  return rows.map((row) => {
    const sender = senderMap.get(row.sender_id);
    return {
      id:           row.id,
      disputeId:    row.dispute_id,
      senderId:     row.sender_id,
      senderName:   sender ? `${sender.firstName} ${sender.lastName}` : 'Unknown',
      senderAvatar: sender?.avatarUrl ?? null,
      content:      row.content,
      isSystem:     row.is_system,
      createdAt:    row.created_at,
    };
  });
}

// ── addDisputeMessage ─────────────────────────────────────────────────────────

export async function addDisputeMessage(
  disputeId: string,
  senderId:  string,
  content:   string,
): Promise<DisputeMessage> {
  const supabase = getServiceClient();
  const row      = await assertParty(disputeId, senderId);

  if (!isActive(row.status)) {
    throw new AppError('Cannot add messages to a closed dispute', 400);
  }

  const now = new Date().toISOString();

  const { data: inserted, error } = await supabase
    .from('dispute_messages')
    .insert({ dispute_id: disputeId, sender_id: senderId, content, is_system: false })
    .select()
    .single();
  if (error || !inserted) throw new AppError('Failed to send message', 500);

  await supabase
    .from('disputes')
    .update({ last_activity_at: now })
    .eq('id', disputeId);

  const msgRow  = inserted as DisputeMessageRow;
  const sender  = await fetchUserMeta(senderId);

  // Notify the other party — fire-and-forget, debounced in notification service
  const otherPartyId = row.filed_by_id === senderId ? row.against_id : row.filed_by_id;
  buildDispute(row).then((built) => {
    const jobRow = prisma.job.findUnique({
      where:  { id: row.job_id },
      select: { id: true, title: true },
    });
    return jobRow.then((j) => {
      notifyNewDisputeMessage({
        dispute:         built,
        senderUser:      { id: senderId, firstName: sender.firstName, lastName: sender.lastName, email: '' },
        recipientUserId: otherPartyId,
        job:             { id: row.job_id, title: j?.title ?? '' },
      });
    });
  }).catch(console.error);

  return {
    id:           msgRow.id,
    disputeId:    msgRow.dispute_id,
    senderId:     msgRow.sender_id,
    senderName:   `${sender.firstName} ${sender.lastName}`,
    senderAvatar: sender.avatarUrl,
    content:      msgRow.content,
    isSystem:     msgRow.is_system,
    createdAt:    msgRow.created_at,
  };
}

// ── submitEvidence ────────────────────────────────────────────────────────────

export async function submitEvidence(
  disputeId:   string,
  submittedBy: string,
  evidence: { type: EvidenceType; url?: string; description: string },
): Promise<DisputeEvidence> {
  const supabase = getServiceClient();
  const row      = await assertParty(disputeId, submittedBy);

  if (!isActive(row.status)) {
    throw new AppError('Cannot submit evidence on a closed dispute', 400);
  }

  const requiresUrl: EvidenceType[] = ['PHOTO', 'VIDEO', 'DOCUMENT'];
  if (requiresUrl.includes(evidence.type) && !evidence.url) {
    throw new AppError(`url is required for evidence type ${evidence.type}`, 400);
  }

  const { data: inserted, error } = await supabase
    .from('dispute_evidence')
    .insert({
      dispute_id:   disputeId,
      submitted_by: submittedBy,
      type:         evidence.type,
      url:          evidence.url ?? null,
      description:  evidence.description,
    })
    .select()
    .single();
  if (error || !inserted) throw new AppError('Failed to submit evidence', 500);

  const now = new Date().toISOString();
  await supabase
    .from('disputes')
    .update({ last_activity_at: now })
    .eq('id', disputeId);

  const submitter = await fetchUserMeta(submittedBy);
  await supabase.from('dispute_messages').insert({
    dispute_id: disputeId,
    sender_id:  submittedBy,
    content:    `${submitter.firstName} submitted new evidence: ${evidence.description}`,
    is_system:  true,
  });

  const evRow = inserted as DisputeEvidenceRow;
  return {
    id:          evRow.id,
    disputeId:   evRow.dispute_id,
    submittedBy: evRow.submitted_by,
    type:        evRow.type as EvidenceType,
    url:         evRow.url,
    description: evRow.description,
    createdAt:   evRow.created_at,
  };
}

// ── withdrawDispute ───────────────────────────────────────────────────────────

export async function withdrawDispute(
  disputeId: string,
  userId:    string,
  reason:    string,
): Promise<void> {
  const supabase = getServiceClient();

  const { data, error: fetchErr } = await supabase
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single();
  if (fetchErr || !data) throw new AppError('Dispute not found', 404);

  const row = data as DisputeRow;
  if (row.filed_by_id !== userId) {
    throw new AppError('Only the person who filed the dispute can withdraw it', 403);
  }
  if (!['OPEN', 'UNDER_REVIEW', 'AWAITING_EVIDENCE'].includes(row.status)) {
    throw new AppError('This dispute cannot be withdrawn in its current status', 400);
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('disputes')
    .update({ status: 'WITHDRAWN', resolved_at: now, last_activity_at: now })
    .eq('id', disputeId);
  if (updateErr) throw new AppError('Failed to withdraw dispute', 500);

  const filer = await fetchUserMeta(userId);
  await supabase.from('dispute_messages').insert({
    dispute_id: disputeId,
    sender_id:  userId,
    content:    `Dispute withdrawn by ${filer.firstName}. Reason: ${reason}`,
    is_system:  true,
  });

  // If funds were held against this dispute milestone, release to contractor
  // TODO: call escrow service once escrow↔dispute linkage is defined
  // e.g. if (row.milestone_draw) await releaseMilestone(row.job_id, row.milestone_draw, ...)

  // Notify the other party — fire-and-forget
  const otherPartyId = row.filed_by_id === userId ? row.against_id : row.filed_by_id;
  buildDispute(row).then((built) => {
    const filerEmail = prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const jobRow     = prisma.job.findUnique({ where: { id: row.job_id }, select: { id: true, title: true } });
    return Promise.all([filerEmail, jobRow]).then(([filerRecord, j]) => {
      notifyDisputeWithdrawn({
        dispute:         built,
        withdrawnByUser: { id: userId, firstName: filer.firstName, lastName: filer.lastName, email: filerRecord?.email ?? '' },
        otherUserId:     otherPartyId,
        job:             { id: row.job_id, title: j?.title ?? '' },
      });
    });
  }).catch(console.error);
}

// ── getDisputeEvidence ────────────────────────────────────────────────────────

export async function getDisputeEvidence(
  disputeId:   string,
  requesterId: string,
): Promise<DisputeEvidence[]> {
  await assertParty(disputeId, requesterId);

  const { data, error } = await getServiceClient()
    .from('dispute_evidence')
    .select('*')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });

  if (error) throw new AppError('Failed to fetch evidence', 500);

  return ((data ?? []) as DisputeEvidenceRow[]).map((row) => ({
    id:          row.id,
    disputeId:   row.dispute_id,
    submittedBy: row.submitted_by,
    type:        row.type as EvidenceType,
    url:         row.url,
    description: row.description,
    createdAt:   row.created_at,
  }));
}

// ── adminGetDispute ───────────────────────────────────────────────────────────
// Admin-only read — no party access check. Used by admin routes that need the
// full Dispute object after performing a direct Supabase update.

export async function adminGetDispute(disputeId: string): Promise<Dispute | null> {
  const { data, error } = await getServiceClient()
    .from('disputes')
    .select('*')
    .eq('id', disputeId)
    .single();
  if (error || !data) return null;
  return buildDispute(data as DisputeRow);
}

// ── getDisputeSummary ─────────────────────────────────────────────────────────

export async function getDisputeSummary(
  userId: string,
): Promise<{ open: number; underReview: number; resolved: number; total: number }> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('disputes')
    .select('status')
    .or(`filed_by_id.eq.${userId},against_id.eq.${userId}`);

  if (error) throw new AppError('Failed to fetch dispute summary', 500);

  const rows = (data ?? []) as { status: string }[];
  return {
    open:        rows.filter((r) => r.status === 'OPEN').length,
    underReview: rows.filter((r) => ['UNDER_REVIEW', 'AWAITING_EVIDENCE', 'PENDING_RULING'].includes(r.status)).length,
    resolved:    rows.filter((r) => ['RESOLVED', 'CLOSED'].includes(r.status)).length,
    total:       rows.length,
  };
}
