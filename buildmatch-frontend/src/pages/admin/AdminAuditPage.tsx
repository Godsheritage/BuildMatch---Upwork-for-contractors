/**
 * src/pages/admin/AdminAuditPage.tsx
 *
 * Full audit log viewer with:
 *  - Filter bar: admin selector, action type, target type, date range
 *  - Table: timestamp, admin name, action badge, target type, target ID (linked),
 *            IP, and expandable payload detail row
 *  - Export CSV: downloads current filtered results
 */

import { useState } from 'react';
import { Link }     from 'react-router-dom';
import { Download } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { useAdminAuditLog, useAdminUsers } from '../../hooks/useAdmin';
import * as adminService from '../../services/admin.service';
import type { AuditLogEntry } from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s  from './AdminAuditPage.module.css';

// ── Audit action list (matches backend enum) ──────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Action category → badge class
function actionBadgeCls(action: string): string {
  if (action.startsWith('USER_'))         return s.badgeUser;
  if (action.startsWith('JOB_'))          return s.badgeJob;
  if (action.startsWith('DISPUTE_'))      return s.badgeDispute;
  if (action.startsWith('PAYMENT_'))      return s.badgePayment;
  if (
    action.startsWith('SETTING_') ||
    action === 'FEATURE_FLAG_CHANGE' ||
    action.startsWith('FILTER_')
  )                                        return s.badgeSetting;
  if (action.startsWith('REVIEW_') || action.startsWith('CONTENT_'))
                                           return s.badgeReview;
  return s.badgeDefault;
}

// Build a link to the relevant admin sub-page based on targetType + targetId
function targetLink(targetType: string, targetId: string): string | null {
  switch (targetType.toLowerCase()) {
    case 'user':             return `/admin/users/${targetId}`;
    case 'job':              return `/admin/jobs/${targetId}`;
    case 'dispute':          return `/admin/disputes/${targetId}`;
    case 'platform_setting':
    case 'feature_flag':
    case 'filter_pattern':   return '/admin/settings';
    default:                 return null;
  }
}

// ── Payload detail row ─────────────────────────────────────────────────────────

function PayloadRow({ entry }: { entry: AuditLogEntry }) {
  const hasPayload = entry.payload && Object.keys(entry.payload).length > 0;
  const hasNote    = !!entry.note;
  if (!hasPayload && !hasNote) {
    return (
      <tr className={s.detailRow}>
        <td colSpan={7}>
          <span className={s.emptyDetail}>No additional details</span>
        </td>
      </tr>
    );
  }
  return (
    <tr className={s.detailRow}>
      <td colSpan={7}>
        {hasNote && (
          <p className={s.noteText}>Note: {entry.note}</p>
        )}
        {hasPayload && (
          <pre className={s.payloadPre}>
            {JSON.stringify(entry.payload, null, 2)}
          </pre>
        )}
      </td>
    </tr>
  );
}

// ── Table row ──────────────────────────────────────────────────────────────────

function AuditRow({
  entry, expanded, onToggle,
}: {
  entry: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const link = targetLink(entry.targetType, entry.targetId);

  return (
    <>
      <tr className={`${s.dataRow} ${expanded ? s.dataRowExpanded : ''}`} onClick={onToggle}>
        <td className={sh.mutedCell} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
          {fmtTs(entry.createdAt)}
        </td>
        <td>
          {entry.adminName ? (
            <span className={s.adminName}>{entry.adminName}</span>
          ) : (
            <span className={sh.mutedCell} style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {entry.adminId.slice(0, 8)}…
            </span>
          )}
        </td>
        <td>
          <span className={`${sh.badge} ${actionBadgeCls(entry.action)}`}>
            {entry.action.replace(/_/g, ' ')}
          </span>
        </td>
        <td className={sh.mutedCell} style={{ fontSize: 12 }}>
          {entry.targetType || '—'}
        </td>
        <td style={{ fontSize: 12 }}>
          {link ? (
            <Link
              to={link}
              className={sh.nameLink}
              style={{ fontFamily: 'monospace', fontSize: 11 }}
              onClick={e => e.stopPropagation()}
            >
              {entry.targetId.slice(0, 12)}…
            </Link>
          ) : (
            <span className={sh.mutedCell} style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {entry.targetId ? `${entry.targetId.slice(0, 12)}…` : '—'}
            </span>
          )}
        </td>
        <td className={sh.mutedCell} style={{ fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' }}>
          {entry.ipAddress ?? '—'}
        </td>
        <td>
          <button
            className={s.expandBtn}
            onClick={e => { e.stopPropagation(); onToggle(); }}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </td>
      </tr>
      {expanded && <PayloadRow entry={entry} />}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminAuditPage() {
  // Filter state
  const [adminId,    setAdminId]    = useState('');
  const [action,     setAction]     = useState('');
  const [targetType, setTargetType] = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [page,       setPage]       = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting,  setExporting]  = useState(false);

  // Admin user dropdown (for the admin selector)
  const { data: adminUsersData } = useAdminUsers({ role: 'ADMIN', limit: 100, page: 1 });
  const adminUsers = adminUsersData?.data ?? [];

  const params: Record<string, unknown> = {
    page,
    limit:    25,
    ...(action     && { action }),
    ...(adminId    && { adminId }),
    ...(targetType && { targetType }),
    ...(dateFrom   && { dateFrom }),
    ...(dateTo     && { dateTo }),
  };

  const { data, isLoading } = useAdminAuditLog(params);

  const entries    = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function resetPage() { setPage(1); setExpandedId(null); }

  async function handleExport() {
    setExporting(true);
    try {
      await adminService.exportAuditLog({
        ...(action     && { action }),
        ...(adminId    && { adminId }),
        ...(targetType && { targetType }),
        ...(dateFrom   && { dateFrom }),
        ...(dateTo     && { dateTo }),
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={sh.page}>
      <AdminPageHeader
        title="Audit Log"
        subtitle={total ? `${total.toLocaleString()} events` : undefined}
        actions={
          <button
            className={`${sh.actionBtn} ${sh.actionBtnGhost}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}
            onClick={handleExport}
            disabled={exporting}
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        }
      />

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className={sh.filters}>
        {/* Admin selector */}
        <select
          className={sh.filterSelect}
          value={adminId}
          onChange={e => { setAdminId(e.target.value); resetPage(); }}
        >
          <option value="">All admins</option>
          {adminUsers.map(u => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>

        {/* Action type */}
        <select
          className={sh.filterSelect}
          value={action}
          onChange={e => { setAction(e.target.value); resetPage(); }}
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map(a => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Target type */}
        <input
          className={sh.searchInput}
          style={{ maxWidth: 160 }}
          placeholder="Target type…"
          value={targetType}
          onChange={e => { setTargetType(e.target.value.trim()); resetPage(); }}
        />

        {/* Date range */}
        <input
          type="date"
          className={sh.searchInput}
          style={{ maxWidth: 150 }}
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); resetPage(); }}
          title="From date"
        />
        <input
          type="date"
          className={sh.searchInput}
          style={{ maxWidth: 150 }}
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); resetPage(); }}
          title="To date"
        />

        {(adminId || action || targetType || dateFrom || dateTo) && (
          <button
            className={`${sh.actionBtn} ${sh.actionBtnGhost}`}
            onClick={() => {
              setAdminId(''); setAction(''); setTargetType('');
              setDateFrom(''); setDateTo('');
              resetPage();
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Target Type</th>
              <th>Target ID</th>
              <th>IP Address</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {[120, 120, 180, 100, 110, 100, 30].map((w, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: w }} /></td>
                  ))}
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={7}>No audit events found</td></tr>
            ) : entries.map(entry => (
              <AuditRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(prev => prev === entry.id ? null : entry.id)}
              />
            ))}
          </tbody>
        </table>

        <div className={sh.pagination}>
          <span>
            {entries.length
              ? `Showing ${((page - 1) * 25) + 1}–${Math.min(page * 25, total)} of ${total.toLocaleString()}`
              : '0 events'}
          </span>
          <div className={sh.paginationBtns}>
            <button className={sh.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              ← Prev
            </button>
            <button className={`${sh.pageBtn} ${sh.pageBtnActive}`}>{page}</button>
            <button className={sh.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
