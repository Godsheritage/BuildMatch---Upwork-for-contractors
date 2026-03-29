import { useState } from 'react';
import {
  useAdminDisputes, useAdminDispute, useRecordRuling, useUpdateDisputeStatus,
} from '../../hooks/useAdmin';
import sh from './admin-shared.module.css';

const DISPUTE_STATUSES = ['OPEN','UNDER_REVIEW','AWAITING_EVIDENCE','PENDING_RULING','RESOLVED','CLOSED','WITHDRAWN'] as const;
const RULING_OPTIONS   = ['INVESTOR_WINS','CONTRACTOR_WINS','SPLIT','NO_ACTION'] as const;
const ADMIN_STATUSES   = ['UNDER_REVIEW','AWAITING_EVIDENCE','PENDING_RULING','CLOSED'] as const;

function statusBadge(s: string) {
  const map: Record<string, string> = {
    OPEN: sh.badgeOpen, UNDER_REVIEW: sh.badgeInProgress, AWAITING_EVIDENCE: sh.badgeInProgress,
    PENDING_RULING: sh.badgeAmber ?? sh.badgeInProgress, RESOLVED: sh.badgeCompleted,
    CLOSED: sh.badgeCompleted, WITHDRAWN: sh.badgeWithdrawn,
  };
  return <span className={`${sh.badge} ${map[s] ?? ''}`}>{s.replace(/_/g, ' ')}</span>;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DisputeDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: dispute, isLoading } = useAdminDispute(id);
  const [ruling,   setRuling]   = useState('');
  const [rulingNote, setRulingNote] = useState('');
  const [newStatus, setNewStatus]   = useState('');
  const [statusNote, setStatusNote] = useState('');

  const { mutate: recordRuling,  isPending: rulingPending  } = useRecordRuling();
  const { mutate: updateStatus,  isPending: statusPending  } = useUpdateDisputeStatus();

  const canRule   = dispute && !['RESOLVED','CLOSED','WITHDRAWN'].includes(dispute.status);
  const canStatus = dispute && !['RESOLVED','CLOSED','WITHDRAWN'].includes(dispute.status);

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Dispute Detail</h3>

        {isLoading ? (
          <p className={sh.modalBody}>Loading…</p>
        ) : dispute ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13, marginBottom: 16 }}>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Job</span><br /><strong>{dispute.jobTitle}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Amount</span><br /><strong>{fmtCurrency(dispute.amountDisputed)}</strong></div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Filed by</span><br />{dispute.filedBy.firstName} {dispute.filedBy.lastName}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Against</span><br />{dispute.against.firstName} {dispute.against.lastName}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Category</span><br />{dispute.category.replace(/_/g, ' ')}</div>
              <div><span style={{ color: 'var(--color-text-muted)' }}>Status</span><br />{statusBadge(dispute.status)}</div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16, lineHeight: '1.5' }}>
              {dispute.description}
            </p>

            {canStatus && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                  CHANGE STATUS
                </label>
                <select className={sh.modalSelect} style={{ marginBottom: 8 }} value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="">Select status…</option>
                  {ADMIN_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <textarea className={sh.modalNote} style={{ minHeight: 56 }} placeholder="Optional note…" value={statusNote} onChange={e => setStatusNote(e.target.value)} />
                <button
                  className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
                  disabled={!newStatus || statusPending}
                  onClick={() => updateStatus({ id, status: newStatus, note: statusNote || undefined }, { onSuccess: onClose })}
                >
                  {statusPending ? 'Saving…' : 'Update Status'}
                </button>
              </div>
            )}

            {canRule && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                  RECORD RULING
                </label>
                <select className={sh.modalSelect} style={{ marginBottom: 8 }} value={ruling} onChange={e => setRuling(e.target.value)}>
                  <option value="">Select ruling…</option>
                  {RULING_OPTIONS.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
                <textarea className={sh.modalNote} style={{ minHeight: 56 }} placeholder="Ruling note (optional)…" value={rulingNote} onChange={e => setRulingNote(e.target.value)} />
                <button
                  className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
                  disabled={!ruling || rulingPending}
                  onClick={() => recordRuling({ id, ruling, note: rulingNote || undefined }, { onSuccess: onClose })}
                >
                  {rulingPending ? 'Saving…' : 'Record Ruling'}
                </button>
              </div>
            )}

            {dispute.ruling && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--color-surface)', borderRadius: 8, fontSize: 13 }}>
                <strong>Ruling:</strong> {dispute.ruling.replace(/_/g, ' ')}
                {dispute.rulingNote && <> — {dispute.rulingNote}</>}
              </div>
            )}
          </>
        ) : (
          <p className={sh.modalBody}>Dispute not found.</p>
        )}

        <div className={sh.modalActions} style={{ marginTop: 16 }}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminDisputesPage() {
  const [status,     setStatus]     = useState('');
  const [page,       setPage]       = useState(1);
  const [detailId,   setDetailId]   = useState<string | null>(null);

  const params = { page, limit: 25, status: status || undefined };
  const { data, isLoading } = useAdminDisputes(params);

  const disputes   = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className={sh.page}>
      <div className={sh.pageHeader}>
        <div>
          <h1 className={sh.pageTitle}>Disputes</h1>
          <p className={sh.pageSubtitle}>{total} total disputes</p>
        </div>
      </div>

      <div className={sh.filters}>
        <select className={sh.filterSelect} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {DISPUTE_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Job</th>
              <th>Filed By</th>
              <th>Against</th>
              <th>Category</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Filed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: j === 0 ? 160 : 80 }} /></td>
                  ))}
                </tr>
              ))
            ) : disputes.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={8}>No disputes found</td></tr>
            ) : disputes.map(d => (
              <tr key={d.id}>
                <td>
                  <div className={sh.nameMain} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.jobTitle || '—'}
                  </div>
                </td>
                <td style={{ color: 'var(--color-text-muted)' }}>{d.filedByName}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>{d.againstName}</td>
                <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{d.category.replace(/_/g, ' ')}</td>
                <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(d.amountDisputed)}
                </td>
                <td>{statusBadge(d.status)}</td>
                <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{fmt(d.createdAt)}</td>
                <td>
                  <button
                    className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
                    onClick={() => setDetailId(d.id)}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={sh.pagination}>
          <span>Showing {disputes.length ? ((page - 1) * 25) + 1 : 0}–{Math.min(page * 25, total)} of {total}</span>
          <div className={sh.paginationBtns}>
            <button className={sh.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className={`${sh.pageBtn} ${sh.pageBtnActive}`}>{page}</button>
            <button className={sh.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>

      {detailId && <DisputeDetailDrawer id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
