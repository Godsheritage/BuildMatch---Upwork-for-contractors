import { getServiceClient } from '../../lib/supabase';
import prisma               from '../../lib/prisma';

// ── Action enum ───────────────────────────────────────────────────────────────
// Must match the admin_action Postgres enum in supabase_admin_tables.sql.

export type AuditAction =
  | 'USER_SUSPEND' | 'USER_UNSUSPEND' | 'USER_BAN' | 'USER_UNBAN'
  | 'USER_ROLE_CHANGE' | 'USER_VERIFY' | 'USER_IMPERSONATE'
  | 'JOB_REMOVE' | 'JOB_FEATURE' | 'JOB_STATUS_CHANGE' | 'JOB_FLAG'
  | 'DISPUTE_RULING' | 'DISPUTE_NOTE' | 'DISPUTE_CLOSE'
  | 'REVIEW_APPROVE' | 'REVIEW_REMOVE' | 'REVIEW_EDIT' | 'REVIEW_FLAG'
  | 'MESSAGE_VIEW' | 'MESSAGE_REMOVE'
  | 'PAYMENT_RETRY' | 'PAYMENT_REFUND'
  | 'SETTING_CHANGE' | 'FEATURE_FLAG_CHANGE'
  | 'FILTER_PATTERN_ADD' | 'FILTER_PATTERN_REMOVE'
  | 'USER_WARN' | 'USER_ESCALATE'
  | 'CONTENT_APPROVE' | 'CONTENT_REMOVE';

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
  id:          string;
  adminId:     string;
  adminName:   string | null;     // enriched from User table
  action:      string;
  targetType:  string;
  targetId:    string;
  payload:     Record<string, unknown> | null;
  ipAddress:   string | null;
  note:        string | null;
  createdAt:   string;
}

export interface AuditLogPage {
  data:       AuditLogEntry[];
  total:      number;
  page:       number;
  totalPages: number;
  limit:      number;
}

// ── Shared query params ────────────────────────────────────────────────────────

export interface AuditLogFilters {
  action?:     string;
  adminId?:    string;
  targetType?: string;
  targetId?:   string;
  dateFrom?:   string;
  dateTo?:     string;
}

// ── Raw Supabase row type ──────────────────────────────────────────────────────

type RawRow = {
  id:          string;
  admin_id:    string;
  action:      string;
  target_type: string;
  target_id:   string;
  payload:     Record<string, unknown> | null;
  ip_address:  string | null;
  note:        string | null;
  created_at:  string;
};

// ── enrichWithAdminNames ──────────────────────────────────────────────────────
// Bulk-lookup admin display names from Prisma to avoid N+1 queries.

async function enrichWithAdminNames(
  rows: RawRow[],
): Promise<AuditLogEntry[]> {
  const uniqueIds = [...new Set(rows.map(r => r.admin_id).filter(Boolean))];

  let nameMap = new Map<string, string>();
  if (uniqueIds.length > 0) {
    try {
      const users = await prisma.user.findMany({
        where:  { id: { in: uniqueIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      for (const u of users) {
        nameMap.set(u.id, `${u.firstName} ${u.lastName}`);
      }
    } catch {
      // Non-fatal — name enrichment is best-effort
    }
  }

  return rows.map(r => ({
    id:         r.id,
    adminId:    r.admin_id,
    adminName:  nameMap.get(r.admin_id) ?? null,
    action:     r.action,
    targetType: r.target_type,
    targetId:   r.target_id,
    payload:    r.payload,
    ipAddress:  r.ip_address,
    note:       r.note,
    createdAt:  r.created_at,
  }));
}

// ── applyFilters (query builder helper) ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(q: any, filters: AuditLogFilters): any {
  if (filters.action)     q = q.eq('action',      filters.action);
  if (filters.adminId)    q = q.eq('admin_id',     filters.adminId);
  if (filters.targetType) q = q.eq('target_type',  filters.targetType);
  if (filters.targetId)   q = q.eq('target_id',    filters.targetId);
  if (filters.dateFrom)   q = q.gte('created_at',  filters.dateFrom);
  if (filters.dateTo)     q = q.lte('created_at',  filters.dateTo);
  return q;
}

// ── getAuditLog ────────────────────────────────────────────────────────────────

export async function getAuditLog(params: AuditLogFilters & {
  page:  number;
  limit: number;
}): Promise<AuditLogPage> {
  const { page, limit, ...filters } = params;
  const offset    = (page - 1) * limit;
  const supabase  = getServiceClient();

  let countQ = supabase.from('audit_log').select('*', { count: 'exact', head: true });
  let dataQ  = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  countQ = applyFilters(countQ, filters);
  dataQ  = applyFilters(dataQ,  filters);

  const [countRes, dataRes] = await Promise.all([countQ, dataQ]);

  const total = countRes.count ?? 0;
  const rows  = (dataRes.data ?? []) as RawRow[];
  const data  = await enrichWithAdminNames(rows);

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
}

// ── getAuditLogAll ─────────────────────────────────────────────────────────────
// Returns the full (non-paginated) matching result set for export.
// Capped at 10 000 rows to prevent runaway downloads.

export async function getAuditLogAll(
  filters: AuditLogFilters,
): Promise<AuditLogEntry[]> {
  const supabase = getServiceClient();

  let q = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, 9_999);

  q = applyFilters(q, filters);

  const { data, error } = await q;
  if (error) throw new Error('Failed to fetch audit log for export');

  const rows = (data ?? []) as RawRow[];
  return enrichWithAdminNames(rows);
}
