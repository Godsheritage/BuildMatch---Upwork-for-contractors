import { getServiceClient } from '../../lib/supabase';

// ── Action enum ───────────────────────────────────────────────────────────────

export type AuditAction =
  | 'USER_BANNED'
  | 'USER_UNBANNED'
  | 'USER_ROLE_CHANGED'
  | 'CONTRACTOR_LICENSE_VERIFIED'
  | 'CONTRACTOR_LICENSE_UNVERIFIED'
  | 'CONTRACTOR_AVAILABILITY_TOGGLED'
  | 'JOB_FORCE_CLOSED'
  | 'DISPUTE_RULING'
  | 'DISPUTE_STATUS_CHANGED';

// ── Write params ──────────────────────────────────────────────────────────────

export interface WriteAuditLogParams {
  adminId:    string;
  action:     AuditAction;
  targetType: 'user' | 'contractor' | 'job' | 'dispute';
  targetId:   string;
  payload:    Record<string, unknown>;
  ipAddress?: string;
  note?:      string;
}

// ── writeAuditLog ─────────────────────────────────────────────────────────────
// Non-fatal: logs errors to console but never throws so the API response
// is never blocked. Call this BEFORE returning a successful response.

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  try {
    const { error } = await getServiceClient()
      .from('audit_log')
      .insert({
        action:    params.action,
        actor_id:  params.adminId,
        entity_id: params.targetId,
        payload: {
          targetType: params.targetType,
          ipAddress:  params.ipAddress ?? null,
          note:       params.note ?? null,
          ...params.payload,
        },
      });

    if (error) console.error('[audit] insert failed:', error.message);
  } catch (err) {
    console.error('[audit] unexpected error:', err);
  }
}

// ── getAuditLog ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id:        number;
  action:    string;
  actorId:   string;
  entityId:  string;
  payload:   Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogPage {
  data:       AuditLogEntry[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

export async function getAuditLog(params: {
  page:      number;
  limit:     number;
  action?:   string;
  adminId?:  string;
}): Promise<AuditLogPage> {
  const { page, limit, action, adminId } = params;
  const offset = (page - 1) * limit;
  const supabase = getServiceClient();

  let countQ = supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true });

  let dataQ = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (action) {
    countQ = countQ.eq('action', action);
    dataQ  = dataQ.eq('action', action);
  }
  if (adminId) {
    countQ = countQ.eq('actor_id', adminId);
    dataQ  = dataQ.eq('actor_id', adminId);
  }

  const [countRes, dataRes] = await Promise.all([countQ, dataQ]);

  const total = countRes.count ?? 0;
  const rows  = (dataRes.data ?? []) as {
    id:         number;
    action:     string;
    actor_id:   string;
    entity_id:  string;
    payload:    Record<string, unknown> | null;
    created_at: string;
  }[];

  return {
    data: rows.map((r) => ({
      id:        r.id,
      action:    r.action,
      actorId:   r.actor_id,
      entityId:  r.entity_id,
      payload:   r.payload ?? {},
      createdAt: r.created_at,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
}
