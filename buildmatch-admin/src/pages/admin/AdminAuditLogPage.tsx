import { useState } from 'react';
import { useAdminAuditLog } from '../../hooks/useAdmin';
import sh from './admin-shared.module.css';

const ACTION_OPTIONS = [
  'USER_BANNED', 'USER_UNBANNED', 'USER_ROLE_CHANGED',
  'CONTRACTOR_LICENSE_VERIFIED', 'CONTRACTOR_LICENSE_UNVERIFIED',
  'CONTRACTOR_AVAILABILITY_TOGGLED',
  'JOB_FORCE_CLOSED',
  'DISPUTE_RULING', 'DISPUTE_STATUS_CHANGED',
] as const;

function fmt(date: string) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function actionBadgeClass(action: string): string {
  if (action.includes('BANNED') || action.includes('CLOSED')) return sh.badgeCancelled;
  if (action.includes('UNBANNED') || action.includes('VERIFIED')) return sh.badgeVerified;
  if (action.includes('RULING') || action.includes('ROLE')) return sh.badgeAmber ?? sh.badgeInProgress;
  return sh.badgeInProgress;
}

export function AdminAuditLogPage() {
  const [action,   setAction]   = useState('');
  const [adminId,  setAdminId]  = useState('');
  const [page,     setPage]     = useState(1);

  const params = { page, limit: 25, action: action || undefined, adminId: adminId || undefined };
  const { data, isLoading } = useAdminAuditLog(params);

  const entries    = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className={sh.page}>
      <div className={sh.pageHeader}>
        <div>
          <h1 className={sh.pageTitle}>Audit Log</h1>
          <p className={sh.pageSubtitle}>{total} total events</p>
        </div>
      </div>

      <div className={sh.filters}>
        <select
          className={sh.filterSelect}
          value={action}
          onChange={e => { setAction(e.target.value); setPage(1); }}
        >
          <option value="">All actions</option>
          {ACTION_OPTIONS.map(a => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <input
          className={sh.searchInput}
          style={{ maxWidth: 220 }}
          placeholder="Filter by admin ID…"
          value={adminId}
          onChange={e => { setAdminId(e.target.value.trim()); setPage(1); }}
        />
      </div>

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Admin</th>
              <th>Target</th>
              <th>Note</th>
              <th>IP Address</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: j === 0 ? 180 : j === 5 ? 130 : 90 }} /></td>
                  ))}
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={6}>No audit events found</td></tr>
            ) : entries.map(e => (
              <tr key={e.id}>
                <td>
                  <span className={`${sh.badge} ${actionBadgeClass(e.action)}`} style={{ fontSize: 11 }}>
                    {e.action.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 12, fontFamily: 'monospace' }}>
                  {e.adminId ? e.adminId.slice(0, 8) + '…' : '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {e.targetId
                    ? <><span style={{ color: 'var(--color-text-primary)' }}>{e.targetType}</span>{' '}{e.targetId.slice(0, 8)}…</>
                    : '—'
                  }
                </td>
                <td style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.note ?? '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {e.ipAddress ?? '—'}
                </td>
                <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {fmt(e.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={sh.pagination}>
          <span>Showing {entries.length ? ((page - 1) * 25) + 1 : 0}–{Math.min(page * 25, total)} of {total}</span>
          <div className={sh.paginationBtns}>
            <button className={sh.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className={`${sh.pageBtn} ${sh.pageBtnActive}`}>{page}</button>
            <button className={sh.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
