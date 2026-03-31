/**
 * src/routes/admin/audit.routes.ts
 * Mounted at: /api/admin/audit
 * Guards: authenticate + requireAdmin (applied in admin/index.ts)
 *
 * GET /          — paginated audit log
 *                  Query: adminId, action, targetType, targetId,
 *                         dateFrom, dateTo, page, limit
 * GET /export    — full filtered log as a downloadable file
 *                  Query: same filters + format ('csv' | 'json')
 *                  Headers: Content-Disposition: attachment
 */

import { Router }       from 'express';
import type { Request, Response } from 'express';
import { z }            from 'zod';
import { sendSuccess, sendError } from '../../utils/response.utils';
import { AppError }     from '../../utils/app-error';
import { getAuditLog, getAuditLogAll } from '../../services/admin/audit.service';
import type { AuditLogEntry } from '../../services/admin/audit.service';

const router = Router();

// ── Shared action list ────────────────────────────────────────────────────────

const AUDIT_ACTIONS = [
  'USER_SUSPEND', 'USER_UNSUSPEND', 'USER_BAN', 'USER_UNBAN',
  'USER_ROLE_CHANGE', 'USER_VERIFY', 'USER_IMPERSONATE',
  'JOB_REMOVE', 'JOB_FEATURE', 'JOB_STATUS_CHANGE', 'JOB_FLAG',
  'DISPUTE_RULING', 'DISPUTE_NOTE', 'DISPUTE_CLOSE',
  'REVIEW_APPROVE', 'REVIEW_REMOVE', 'REVIEW_EDIT', 'REVIEW_FLAG',
  'MESSAGE_VIEW', 'MESSAGE_REMOVE',
  'PAYMENT_RETRY', 'PAYMENT_REFUND',
  'SETTING_CHANGE', 'FEATURE_FLAG_CHANGE',
  'FILTER_PATTERN_ADD', 'FILTER_PATTERN_REMOVE',
  'USER_WARN', 'USER_ESCALATE',
  'CONTENT_APPROVE', 'CONTENT_REMOVE',
] as const;

// ── Schemas ────────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(25),
  action:     z.enum(AUDIT_ACTIONS).optional(),
  adminId:    z.string().optional(),
  targetType: z.string().optional(),
  targetId:   z.string().optional(),
  dateFrom:   z.string().optional(),
  dateTo:     z.string().optional(),
});

const exportQuerySchema = z.object({
  format:     z.enum(['csv', 'json']).default('json'),
  action:     z.enum(AUDIT_ACTIONS).optional(),
  adminId:    z.string().optional(),
  targetType: z.string().optional(),
  targetId:   z.string().optional(),
  dateFrom:   z.string().optional(),
  dateTo:     z.string().optional(),
});

// ── GET /export ───────────────────────────────────────────────────────────────
// Must be declared before GET / (or any /:param) — static segment first.

router.get('/export', async (req: Request, res: Response): Promise<void> => {
  const parsed = exportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }

  const { format, ...filters } = parsed.data;
  const dateLabel = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const rows = await getAuditLogAll(filters);

    if (format === 'csv') {
      const csv = toCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-${dateLabel}.csv"`);
      res.status(200).send(csv);
      return;
    }

    // JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${dateLabel}.json"`);
    res.status(200).json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/audit] GET /export error:', err);
    sendError(res, 'Failed to export audit log', 500);
  }
});

// ── GET / ─────────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Invalid query', 400);
    return;
  }

  try {
    const result = await getAuditLog(parsed.data);
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof AppError) { sendError(res, err.message, err.statusCode); return; }
    console.error('[admin/audit] GET / error:', err);
    sendError(res, 'Failed to fetch audit log', 500);
  }
});

// ── CSV serialiser ────────────────────────────────────────────────────────────

const CSV_COLUMNS: (keyof AuditLogEntry)[] = [
  'createdAt', 'adminId', 'adminName', 'action',
  'targetType', 'targetId', 'ipAddress', 'note',
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Wrap in quotes if the value contains a comma, quote, or newline.
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows: AuditLogEntry[]): string {
  const header = CSV_COLUMNS.join(',');
  const lines  = rows.map(row =>
    CSV_COLUMNS.map(col => csvEscape(row[col])).join(','),
  );
  return [header, ...lines].join('\r\n');
}

export default router;
