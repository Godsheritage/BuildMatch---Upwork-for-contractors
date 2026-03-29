import { getServiceClient } from '../../lib/supabase';

// ── Action enum ───────────────────────────────────────────────────────────────
// Must match the admin_action Postgres enum in supabase_admin_tables.sql.

export type AuditAction =
  | 'USER_SUSPEND' | 'USER_UNSUSPEND' | 'USER_BAN' | 'USER_UNBAN'
  | 'USER_ROLE_CHANGE' | 'USER_VERIFY' | 'USER_IMPERSONATE'
  | 'JOB_REMOVE' | 'JOB_FEATURE' | 'JOB_STATUS_CHANGE'
  | 'DISPUTE_RULING' | 'DISPUTE_NOTE' | 'DISPUTE_CLOSE'
  | 'REVIEW_APPROVE' | 'REVIEW_REMOVE' | 'REVIEW_EDIT'
  | 'MESSAGE_VIEW' | 'MESSAGE_REMOVE'
  | 'PAYMENT_RETRY' | 'PAYMENT_REFUND'
  | 'SETTING_CHANGE' | 'FEATURE_FLAG_CHANGE'
  | 'FILTER_PATTERN_ADD' | 'FILTER_PATTERN_REMOVE';

// ── Params ────────────────────────────────────────────────────────────────────

export interface LogAdminActionParams {
  adminId:    string;
  action:     AuditAction;
  targetType: string;
  targetId:   string;
  payload?:   Record<string, unknown>;
  ipAddress?: string;
  note?:      string;
}

// ── logAdminAction ────────────────────────────────────────────────────────────
// Uses the Supabase SERVICE ROLE client so it bypasses RLS on audit_log.
// Non-fatal: if the insert fails we log the error but never throw, ensuring
// audit failures never block the admin action itself.

export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  try {
    const { error } = await getServiceClient()
      .from('audit_log')
      .insert({
        admin_id:    params.adminId,
        action:      params.action,
        target_type: params.targetType,
        target_id:   params.targetId,
        payload:     params.payload ?? null,
        ip_address:  params.ipAddress ?? null,
        note:        params.note ?? null,
      });

    if (error) console.error('[audit] insert failed:', error.message);
  } catch (err) {
    console.error('[audit] unexpected error:', err);
  }
}

// Backward-compat alias — existing call sites using writeAuditLog still work.
export const writeAuditLog = logAdminAction;

// ── AuditLogEntry (response shape) ────────────────────────────────────────────

export interface AuditLogEntry {
  id:         string;
  adminId:    string;
  action:     string;
  targetType: string;
  targetId:   string;
  payload:    Record<string, unknown> | null;
  ipAddress:  string | null;
  note:       string | null;
  createdAt:  string;
}

export interface AuditLogPage {
  data:       AuditLogEntry[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

// ── getAuditLog ────────────────────────────────────────────────────────────────

export async function getAuditLog(params: {
  page:      number;
  limit:     number;
  action?:   string;
  adminId?:  string;
}): Promise<AuditLogPage> {
  const { page, limit, action, adminId } = params;
  const offset = (page - 1) * limit;
  const supabase = getServiceClient();

  let countQ = supabase.from('audit_log').select('*', { count: 'exact', head: true });
  let dataQ  = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (action)  { countQ = countQ.eq('action',   action);   dataQ = dataQ.eq('action',   action); }
  if (adminId) { countQ = countQ.eq('admin_id', adminId);  dataQ = dataQ.eq('admin_id', adminId); }

  const [countRes, dataRes] = await Promise.all([countQ, dataQ]);

  const total = countRes.count ?? 0;
  const rows  = (dataRes.data ?? []) as {
    id:          string;
    admin_id:    string;
    action:      string;
    target_type: string;
    target_id:   string;
    payload:     Record<string, unknown> | null;
    ip_address:  string | null;
    note:        string | null;
    created_at:  string;
  }[];

  return {
    data: rows.map((r) => ({
      id:         r.id,
      adminId:    r.admin_id,
      action:     r.action,
      targetType: r.target_type,
      targetId:   r.target_id,
      payload:    r.payload,
      ipAddress:  r.ip_address,
      note:       r.note,
      createdAt:  r.created_at,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
}
