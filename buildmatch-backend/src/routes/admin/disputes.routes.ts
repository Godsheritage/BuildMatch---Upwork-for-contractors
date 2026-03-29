/**
 * src/routes/admin/disputes.routes.ts
 *
 * Admin-only dispute management endpoints.
 * All routes require authenticate + requireAdmin (two middleware layers).
 *
 * Mounted at: /api/admin/disputes
 *
 * Routes
 * ──────
 *   GET  /api/admin/disputes               — paginated list of all disputes
 *   GET  /api/admin/disputes/:id           — dispute detail
 *   POST /api/admin/disputes/:id/ruling    — record ruling, resolve dispute, notify both parties
 *   PUT  /api/admin/disputes/:id/status    — change status, insert system message, notify parties
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/admin.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { getServiceClient } from '../../lib/supabase';
import { adminGetDispute } from '../../services/dispute.service';
import { writeAuditLog } from '../../services/admin/audit.service';
import {
  notifyStatusChange,
} from '../../services/dispute-notifications.service';
import type { DisputeStatus } from '../../types/dispute.types';
import prisma from '../../lib/prisma';

const router = Router();

// Every route in this file requires authenticate THEN requireAdmin
router.use(authenticate, requireAdmin);

// ── Schemas ────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum([
    'OPEN', 'UNDER_REVIEW', 'AWAITING_EVIDENCE',
    'PENDING_RULING', 'RESOLVED', 'CLOSED', 'WITHDRAWN',
  ] as const).optional(),
});

// ── GET /api/admin/disputes ───────────────────────────────────────────────────
// NOTE: declared before /:id to avoid param capture

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }
  const { page, limit, status } = parsed.data;
  const offset = (page - 1) * limit;
  const supabase = getServiceClient();

  try {
    let countQ = supabase.from('disputes').select('*', { count: 'exact', head: true });
    let dataQ  = supabase
      .from('disputes').select('id, job_id, filed_by_id, against_id, status, category, amount_disputed, created_at, last_activity_at')
      .order('last_activity_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) { countQ = countQ.eq('status', status); dataQ = dataQ.eq('status', status); }

    const [countRes, dataRes] = await Promise.all([countQ, dataQ]);
    if (countRes.error || dataRes.error) throw new AppError('Failed to fetch disputes', 500);

    type DisputeRow = { id: string; job_id: string; filed_by_id: string; against_id: string; status: string; category: string; amount_disputed: number; created_at: string; last_activity_at: string };
    const rows = (dataRes.data ?? []) as DisputeRow[];
    const total = countRes.count ?? 0;

    // Enrich with job titles and party names
    const jobIds     = [...new Set(rows.map(r => r.job_id))];
    const partyIds   = [...new Set([...rows.map(r => r.filed_by_id), ...rows.map(r => r.against_id)])];
    const [jobs, users] = await Promise.all([
      jobIds.length   > 0 ? prisma.job.findMany({ where: { id: { in: jobIds } },   select: { id: true, title: true } }) : [],
      partyIds.length > 0 ? prisma.user.findMany({ where: { id: { in: partyIds } }, select: { id: true, firstName: true, lastName: true } }) : [],
    ]);
    const jobMap  = new Map(jobs.map(j  => [j.id,  j.title]));
    const userMap = new Map(users.map(u => [u.id,  `${u.firstName} ${u.lastName}`]));

    sendSuccess(res, {
      data: rows.map(r => ({
        id:             r.id,
        jobId:          r.job_id,
        jobTitle:       jobMap.get(r.job_id) ?? '',
        filedById:      r.filed_by_id,
        filedByName:    userMap.get(r.filed_by_id) ?? '',
        againstId:      r.against_id,
        againstName:    userMap.get(r.against_id) ?? '',
        status:         r.status,
        category:       r.category,
        amountDisputed: Number(r.amount_disputed),
        createdAt:      r.created_at,
        lastActivityAt: r.last_activity_at,
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

// ── GET /api/admin/disputes/:id ───────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const dispute = await adminGetDispute(req.params.id);
    if (!dispute) { sendError(res, 'Dispute not found', 404); return; }
    sendSuccess(res, dispute);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/disputes] GET /:id error:', err);
    sendError(res, 'Failed to fetch dispute', 500);
  }
});

// ── Validation schemas ────────────────────────────────────────────────────────

const RULING_VALUES = [
  'INVESTOR_WINS',
  'CONTRACTOR_WINS',
  'SPLIT',
  'WITHDRAWN',
  'NO_ACTION',
] as const;

const rulingSchema = z.object({
  ruling: z.enum(RULING_VALUES, { error: 'ruling must be a valid DisputeRuling value' }),
  note:   z.string().max(2000).optional(),
});

// Statuses the admin portal is allowed to set via the status endpoint.
// OPEN and WITHDRAWN are user-initiated; RESOLVED is set only via the ruling endpoint.
const ADMIN_SETTABLE_STATUSES = [
  'UNDER_REVIEW',
  'AWAITING_EVIDENCE',
  'PENDING_RULING',
  'CLOSED',
] as const;

const adminStatusSchema = z.object({
  status: z.enum(ADMIN_SETTABLE_STATUSES, {
    error: `status must be one of: ${ADMIN_SETTABLE_STATUSES.join(', ')}`,
  }),
  note: z.string().max(2000).optional(),
});


// ── POST /api/admin/disputes/:id/ruling ───────────────────────────────────────
//
// Record a ruling and resolve the dispute.
// Notifies BOTH parties about the resolution.

router.post('/:id/ruling', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const adminId = req.user!.userId;

  const parsed = rulingSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    return;
  }
  const { ruling, note } = parsed.data;

  try {
    const supabase = getServiceClient();

    // 1. Fetch the current dispute and verify it can be resolved
    const existing = await adminGetDispute(id);
    if (!existing) {
      sendError(res, 'Dispute not found', 404);
      return;
    }
    if (existing.status === 'RESOLVED' || existing.status === 'CLOSED') {
      sendError(res, `Dispute is already ${existing.status.toLowerCase()}`, 400);
      return;
    }
    if (existing.status === 'WITHDRAWN') {
      sendError(res, 'Cannot rule on a withdrawn dispute', 400);
      return;
    }

    const now = new Date().toISOString();

    // 2. Update dispute to RESOLVED
    const { error: updateErr } = await supabase
      .from('disputes')
      .update({
        status:           'RESOLVED',
        ruling,
        ruling_note:      note ?? null,
        resolved_at:      now,
        last_activity_at: now,
      })
      .eq('id', id);
    if (updateErr) throw new AppError('Failed to update dispute', 500);

    // 3. Insert system message
    const rulingLabels: Record<string, string> = {
      INVESTOR_WINS:   'resolved in favour of the investor',
      CONTRACTOR_WINS: 'resolved in favour of the contractor',
      SPLIT:           'resolved with a split award',
      WITHDRAWN:       'closed as withdrawn',
      NO_ACTION:       'closed with no action taken',
    };
    const rulingLabel = rulingLabels[ruling] ?? ruling.toLowerCase().replace(/_/g, ' ');
    const noteClause  = note ? ` Admin note: ${note}` : '';
    await supabase.from('dispute_messages').insert({
      dispute_id: id,
      sender_id:  adminId,
      content:    `This dispute has been ${rulingLabel}.${noteClause}`,
      is_system:  true,
    });

    // 4. Audit log (non-fatal)
    void writeAuditLog({
      adminId,
      action:     'DISPUTE_RULING',
      targetType: 'dispute',
      targetId:   id,
      payload:    { ruling, note: note ?? null, previousStatus: existing.status },
      ipAddress:  req.ip,
    });

    // 5. Fetch the fully-built resolved dispute for the response and notifications
    const resolved = await adminGetDispute(id);
    if (!resolved) throw new AppError('Failed to retrieve updated dispute', 500);

    // 6. Notify both parties — fire-and-forget
    const jobRef = { id: resolved.jobId, title: resolved.jobTitle };
    notifyStatusChange({
      dispute:        resolved,
      newStatus:      'RESOLVED',
      affectedUserId: resolved.filedById,
      job:            jobRef,
    }).catch(console.error);
    notifyStatusChange({
      dispute:        resolved,
      newStatus:      'RESOLVED',
      affectedUserId: resolved.againstId,
      job:            jobRef,
    }).catch(console.error);

    sendSuccess(res, resolved, 'Dispute resolved successfully');
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin-disputes] POST /:id/ruling error:', err);
    sendError(res, 'An unexpected error occurred', 500);
  }
});

// ── PUT /api/admin/disputes/:id/status ────────────────────────────────────────
//
// Update dispute status with optional admin note.
// Inserts a status-specific system message and notifies the relevant parties.

router.put('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const adminId = req.user!.userId;

  const parsed = adminStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid request body', 400);
    return;
  }
  const { status, note } = parsed.data;
  const newStatus = status as DisputeStatus;

  try {
    const supabase = getServiceClient();

    // 1. Fetch current dispute
    const existing = await adminGetDispute(id);
    if (!existing) {
      sendError(res, 'Dispute not found', 404);
      return;
    }
    if (existing.status === newStatus) {
      sendError(res, `Dispute is already in status ${newStatus}`, 400);
      return;
    }
    if (['RESOLVED', 'CLOSED', 'WITHDRAWN'].includes(existing.status)) {
      sendError(res, `Cannot change status of a ${existing.status.toLowerCase()} dispute`, 400);
      return;
    }

    const now = new Date().toISOString();

    // 2. Update status (and note if provided — stored as ruling_note for admin reference)
    const { error: updateErr } = await supabase
      .from('disputes')
      .update({
        status:           newStatus,
        ruling_note:      note ?? null,
        last_activity_at: now,
      })
      .eq('id', id);
    if (updateErr) throw new AppError('Failed to update dispute status', 500);

    // 3. Status-specific system message + notification logic
    const systemMessages: Partial<Record<DisputeStatus, string>> = {
      AWAITING_EVIDENCE:
        'BuildMatch has requested additional evidence. Please submit supporting materials within 5 business days.',
      UNDER_REVIEW:
        'BuildMatch is reviewing this dispute.',
      PENDING_RULING:
        'BuildMatch has completed its evidence review and will issue a ruling shortly.',
      CLOSED:
        'This dispute has been closed by BuildMatch.',
    };

    const messageContent = systemMessages[newStatus];
    if (messageContent) {
      await supabase.from('dispute_messages').insert({
        dispute_id: id,
        sender_id:  adminId,
        content:    note ? `${messageContent} Admin note: ${note}` : messageContent,
        is_system:  true,
      });
    }

    // 4. Audit log (non-fatal)
    void writeAuditLog({
      adminId,
      action:     newStatus === 'CLOSED' ? 'DISPUTE_CLOSE' : 'DISPUTE_NOTE',
      targetType: 'dispute',
      targetId:   id,
      payload:    { status: newStatus, previousStatus: existing.status },
      ipAddress:  req.ip,
      note:       note,
    });

    // 5. Fetch updated dispute for the response and notifications
    const updated = await adminGetDispute(id);
    if (!updated) throw new AppError('Failed to retrieve updated dispute', 500);

    const jobRef = { id: updated.jobId, title: updated.jobTitle };

    // 6. Notifications — fire-and-forget
    if (newStatus === 'AWAITING_EVIDENCE') {
      // Both parties must respond
      notifyStatusChange({ dispute: updated, newStatus, affectedUserId: updated.filedById, job: jobRef })
        .catch(console.error);
      notifyStatusChange({ dispute: updated, newStatus, affectedUserId: updated.againstId, job: jobRef })
        .catch(console.error);
    } else if (newStatus === 'UNDER_REVIEW') {
      // Only the filer needs to know the review has started
      notifyStatusChange({ dispute: updated, newStatus, affectedUserId: updated.filedById, job: jobRef })
        .catch(console.error);
    } else if (newStatus === 'PENDING_RULING' || newStatus === 'CLOSED') {
      // Notify both parties for terminal/near-terminal transitions
      notifyStatusChange({ dispute: updated, newStatus, affectedUserId: updated.filedById, job: jobRef })
        .catch(console.error);
      notifyStatusChange({ dispute: updated, newStatus, affectedUserId: updated.againstId, job: jobRef })
        .catch(console.error);
    }

    sendSuccess(res, updated, `Dispute status updated to ${newStatus}`);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin-disputes] PUT /:id/status error:', err);
    sendError(res, 'An unexpected error occurred', 500);
  }
});

export default router;
