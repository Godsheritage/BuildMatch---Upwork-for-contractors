import { useState, useCallback } from 'react';
import { Search, XCircle } from 'lucide-react';
import { useAdminJobs, useForceCloseJob } from '../../hooks/useAdmin';
import sh from './admin-shared.module.css';

const STATUSES   = ['OPEN', 'AWARDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const TRADE_TYPES = ['GENERAL','ELECTRICAL','PLUMBING','HVAC','ROOFING','FLOORING','PAINTING','LANDSCAPING','DEMOLITION','OTHER'];

function statusBadge(s: string) {
  const map: Record<string, string> = {
    OPEN: sh.badgeOpen, AWARDED: sh.badgeAwarded, IN_PROGRESS: sh.badgeInProgress,
    COMPLETED: sh.badgeCompleted, CANCELLED: sh.badgeCancelled,
  };
  return <span className={`${sh.badge} ${map[s] ?? ''}`}>{s.replace('_', ' ')}</span>;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtBudget(min: number, max: number) {
  const f = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
  return `${f(min)} – ${f(max)}`;
}

type CloseModal = { jobId: string; title: string } | null;

function ConfirmCloseModal({ target, onClose }: { target: CloseModal; onClose: () => void }) {
  const [note, setNote] = useState('');
  const { mutate, isPending } = useForceCloseJob();
  if (!target) return null;

  function submit() {
    mutate({ id: target!.jobId, note: note || undefined }, { onSuccess: onClose });
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Force-Close Job</h3>
        <p className={sh.modalBody}>
          This will cancel <strong>"{target.title}"</strong> immediately. This action is irreversible and will be logged in the audit trail.
        </p>
        <textarea
          className={sh.modalNote}
          placeholder="Reason for closing (optional)…"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Cancel</button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnRed}`}
            onClick={submit}
            disabled={isPending}
          >
            {isPending ? 'Closing…' : 'Force Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminJobsPage() {
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('');
  const [tradeType, setTradeType] = useState('');
  const [page,      setPage]      = useState(1);
  const [closeModal, setCloseModal] = useState<CloseModal>(null);

  const params = { page, limit: 25, search: search || undefined, status: status || undefined, tradeType: tradeType || undefined };
  const { data, isLoading } = useAdminJobs(params);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value); setPage(1);
  }, []);

  const jobs       = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className={sh.page}>
      <div className={sh.pageHeader}>
        <div>
          <h1 className={sh.pageTitle}>Jobs</h1>
          <p className={sh.pageSubtitle}>{total} total jobs</p>
        </div>
      </div>

      <div className={sh.filters}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          <input
            className={sh.searchInput}
            style={{ paddingLeft: 30 }}
            placeholder="Search job title…"
            value={search}
            onChange={handleSearch}
          />
        </div>
        <select className={sh.filterSelect} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select className={sh.filterSelect} value={tradeType} onChange={e => { setTradeType(e.target.value); setPage(1); }}>
          <option value="">All trades</option>
          {TRADE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Job</th>
              <th>Investor</th>
              <th>Trade</th>
              <th>Location</th>
              <th>Budget</th>
              <th>Status</th>
              <th>Bids</th>
              <th>Posted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: j === 0 ? 160 : 70 }} /></td>
                  ))}
                </tr>
              ))
            ) : jobs.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={9}>No jobs found</td></tr>
            ) : jobs.map(j => (
              <tr key={j.id}>
                <td>
                  <div className={sh.nameMain} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {j.title}
                  </div>
                </td>
                <td style={{ color: 'var(--color-text-muted)' }}>{j.investorName}</td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{j.tradeType}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>{j.city}, {j.state}</td>
                <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{fmtBudget(j.budgetMin, j.budgetMax)}</td>
                <td>{statusBadge(j.status)}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>{j.bidCount}</td>
                <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{fmt(j.createdAt)}</td>
                <td>
                  {!['COMPLETED', 'CANCELLED'].includes(j.status) && (
                    <button
                      className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                      onClick={() => setCloseModal({ jobId: j.id, title: j.title })}
                      title="Force close job"
                    >
                      <XCircle size={12} style={{ marginRight: 4 }} />
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={sh.pagination}>
          <span>Showing {jobs.length ? ((page - 1) * 25) + 1 : 0}–{Math.min(page * 25, total)} of {total}</span>
          <div className={sh.paginationBtns}>
            <button className={sh.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className={`${sh.pageBtn} ${sh.pageBtnActive}`}>{page}</button>
            <button className={sh.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>

      <ConfirmCloseModal target={closeModal} onClose={() => setCloseModal(null)} />
    </div>
  );
}
