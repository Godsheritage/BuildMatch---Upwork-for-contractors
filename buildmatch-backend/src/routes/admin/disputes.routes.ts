/**
 * src/routes/admin/disputes.routes.ts
 *
 * Admin-only dispute management endpoints.
 * All routes require authenticate + requireRole('ADMIN').
 *
 * Mounted at: /api/admin/disputes
 *
 * Routes
 * ──────
 *   POST /api/admin/disputes/:id/ruling    — record ruling, resolve dispute, notify both parties
 *   PUT  /api/admin/disputes/:id/status    — change status, insert system message, notify parties
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError } from '../../utils/app-error';
import { getServiceClient } from '../../lib/supabase';
import { adminGetDispute } from '../../services/dispute.service';
import {
  notifyStatusChange,
} from '../../services/dispute-notifications.service';
import type { DisputeStatus } from '../../types/dispute.types';

const router = Router();

// Every route in this file is admin-only
router.use(authenticate, requireRole('ADMIN'));

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

// ── Audit log helper ──────────────────────────────────────────────────────────
// Non-fatal: if the audit_log table does not exist yet the operation still succeeds.
// Schema expected: id (auto), action text, actor_id text, entity_id text,
//                 payload jsonb, created_at timestamptz default now().

function writeAuditLog(opts: {
  action:    string;
  actorId:   string;
  entityId:  string;
  payload:   Record<string, unknown>;
}): void {
  void (async () => {
    await getServiceClient()
      .from('audit_log')
      .insert({
        action:    opts.action,
        actor_id:  opts.actorId,
        entity_id: opts.entityId,
        payload:   opts.payload,
      });
  })().catch((e: unknown) =>
    console.error('[admin-disputes] audit_log insert failed (table may not exist):', e),
  );
}

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
    writeAuditLog({
      action:   'DISPUTE_RULING',
      actorId:  adminId,
      entityId: id,
      payload:  { ruling, note, previousStatus: existing.status },
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
    writeAuditLog({
      action:   'DISPUTE_STATUS_CHANGE',
      actorId:  adminId,
      entityId: id,
      payload:  { status: newStatus, note: note ?? null, previousStatus: existing.status },
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
