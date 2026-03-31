import { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Star, AlertTriangle, Eye, Trash2,
} from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { ConfirmModal } from '../../components/admin/shared/ConfirmModal';
import {
  useAdminJobs, useAdminJobsContentQueue,
  useRemoveJob, useToggleFeatureJob,
} from '../../hooks/useAdmin';
import type { AdminJob, ContentQueueItem } from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s from './AdminJobsPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtBudget(min: number, max: number) {
  const f = (n: number) => n >= 1_000 ? `$${(n / 1_000).toFixed(0)}k` : `$${n}`;
  return `${f(min)}–${f(max)}`;
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    OPEN:        sh.badgeOpen,
    AWARDED:     sh.badgeAwarded,
    IN_PROGRESS: sh.badgeInProgress,
    COMPLETED:   sh.badgeCompleted,
    CANCELLED:   sh.badgeCancelled,
  };
  return (
    <span className={`${sh.badge} ${cls[status] ?? ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = 'all' | 'queue' | 'nobids' | 'stuck';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all',    label: 'All' },
  { id: 'queue',  label: 'Content Queue' },
  { id: 'nobids', label: 'No Bids (7d+)' },
  { id: 'stuck',  label: 'Stuck In Progress' },
];

const STATUSES    = ['OPEN', 'AWARDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const TRADE_TYPES = [
  'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING',
  'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
];

// ── Remove modal ──────────────────────────────────────────────────────────────

interface RemoveTarget { id: string; title: string }

function RemoveJobModal({
  target, onClose,
}: { target: RemoveTarget | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [typed,  setTyped]  = useState('');
  const { mutate, isPending } = useRemoveJob();

  useEffect(() => { if (!target) { setReason(''); setTyped(''); } }, [target]);
  if (!target) return null;

  function submit() {
    if (typed !== 'REMOVE' || !reason.trim()) return;
    mutate({ id: target!.id, reason: reason.trim() }, { onSuccess: onClose });
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={`${sh.modalTitle} ${s.modalDanger}`}>Remove Job Listing</h3>
        <p className={sh.modalBody}>
          Cancel <strong>"{target.title}"</strong>, notify the investor by email,
          and log the action. Active escrow funds will be queued for refund.
        </p>
        <label className={s.modalLabel}>
          Reason <span className={s.modalRequired}>*</span>
        </label>
        <textarea
          className={sh.modalNote}
          placeholder="Explain why this listing is being removed…"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
        />
        <label className={s.modalLabel} style={{ marginTop: 12 }}>
          Type <strong>REMOVE</strong> to confirm
        </label>
        <input
          className={s.phraseInput}
          placeholder="REMOVE"
          value={typed}
          onChange={e => setTyped(e.target.value)}
        />
        <div className={sh.modalActions}>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnGhost}`}
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnRed}`}
            onClick={submit}
            disabled={isPending || typed !== 'REMOVE' || !reason.trim()}
          >
            {isPending ? 'Removing…' : 'Remove Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Feature confirm modal ─────────────────────────────────────────────────────

interface FeatureTarget { id: string; title: string; isFeatured: boolean }

function FeatureModal({
  target, onClose,
}: { target: FeatureTarget | null; onClose: () => void }) {
  const { mutate, isPending } = useToggleFeatureJob();
  if (!target) return null;
  const action = target.isFeatured ? 'Unfeature' : 'Feature';
  return (
    <ConfirmModal
      isOpen
      onClose={onClose}
      onConfirm={() => mutate(target.id, { onSuccess: onClose })}
      title={`${action} Job`}
      message={`${action} "${target.title}"?${target.isFeatured ? ' It will be removed from featured listings.' : ' It will appear featured to all users.'}`}
      confirmLabel={action}
      variant="primary"
      isLoading={isPending}
    />
  );
}

// ── Kebab row menu ────────────────────────────────────────────────────────────

function RowActions({
  job, onRemove, onFeature,
}: {
  job:       AdminJob;
  onRemove:  (t: RemoveTarget)  => void;
  onFeature: (t: FeatureTarget) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className={s.kebab}>
      <button className={s.kebabTrigger} onClick={() => setOpen(o => !o)}>
        ···
      </button>
      {open && (
        <div className={s.kebabMenu}>
          <button
            className={s.kebabItem}
            onClick={() => { setOpen(false); navigate(`/admin/jobs/${job.id}`); }}
          >
            <Eye size={12} style={{ marginRight: 6 }} /> View Detail
          </button>
          <button
            className={s.kebabItem}
            onClick={() => {
              setOpen(false);
              onFeature({ id: job.id, title: job.title, isFeatured: job.isFeatured });
            }}
          >
            <Star size={12} style={{ marginRight: 6 }} />
            {job.isFeatured ? 'Unfeature' : 'Feature'}
          </button>
          {!['COMPLETED', 'CANCELLED'].includes(job.status) && (
            <button
              className={`${s.kebabItem} ${s.kebabDanger}`}
              onClick={() => { setOpen(false); onRemove({ id: job.id, title: job.title }); }}
            >
              <Trash2 size={12} style={{ marginRight: 6 }} /> Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Jobs table ────────────────────────────────────────────────────────────────

function JobsTable({
  jobs, isLoading, onRemove, onFeature,
}: {
  jobs:      AdminJob[];
  isLoading: boolean;
  onRemove:  (t: RemoveTarget)  => void;
  onFeature: (t: FeatureTarget) => void;
}) {
  return (
    <div className={sh.tableWrap}>
      <table className={sh.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Trade</th>
            <th>Investor</th>
            <th>Budget</th>
            <th>Bids</th>
            <th>Status</th>
            <th>Posted</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: j === 0 ? 180 : 70 }} /></td>
                  ))}
                </tr>
              ))
            : jobs.length === 0
              ? <tr className={sh.emptyRow}><td colSpan={8}>No jobs found</td></tr>
              : jobs.map(j => (
                  <tr key={j.id}>
                    <td>
                      <div className={s.titleCell}>
                        {j.isFeatured && (
                          <Star size={12} className={s.starIcon} title="Featured" fill="currentColor" />
                        )}
                        {j.isFlagged && (
                          <AlertTriangle size={12} className={s.flagIcon} title="Flagged for review" />
                        )}
                        <Link to={`/admin/jobs/${j.id}`} className={sh.nameLink}>
                          {j.title}
                        </Link>
                        {j.disputeCount > 0 && (
                          <span className={s.disputePill}>{j.disputeCount}d</span>
                        )}
                      </div>
                      <div className={s.titleSub}>{j.city}, {j.state}</div>
                    </td>
                    <td className={sh.mutedCell}>{j.tradeType}</td>
                    <td>
                      <Link to={`/admin/users/${j.investorId}`} className={sh.nameLink}>
                        {j.investorName}
                      </Link>
                    </td>
                    <td className={sh.mutedCell} style={{ whiteSpace: 'nowrap' }}>
                      {fmtBudget(j.budgetMin, j.budgetMax)}
                    </td>
                    <td className={sh.mutedCell}>{j.bidCount}</td>
                    <td><StatusBadge status={j.status} /></td>
                    <td className={sh.mutedCell} style={{ whiteSpace: 'nowrap' }}>
                      {fmt(j.createdAt)}
                    </td>
                    <td>
                      <RowActions job={j} onRemove={onRemove} onFeature={onFeature} />
                    </td>
                  </tr>
                ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Content queue table ───────────────────────────────────────────────────────

function ContentQueueTable({
  items, isLoading, onRemove,
}: {
  items:     ContentQueueItem[];
  isLoading: boolean;
  onRemove:  (t: RemoveTarget) => void;
}) {
  return (
    <div className={sh.tableWrap}>
      <table className={sh.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Trade</th>
            <th>Investor</th>
            <th>Bids</th>
            <th>Flag Reason</th>
            <th>Flagged</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: j === 0 ? 180 : 80 }} /></td>
                  ))}
                </tr>
              ))
            : items.length === 0
              ? <tr className={sh.emptyRow}><td colSpan={7}>Content queue is clear</td></tr>
              : items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className={s.titleCell}>
                        <AlertTriangle size={12} className={s.flagIcon} />
                        <Link to={`/admin/jobs/${item.id}`} className={sh.nameLink}>
                          {item.title}
                        </Link>
                      </div>
                      <div className={s.titleSub}>{item.city}, {item.state}</div>
                    </td>
                    <td className={sh.mutedCell}>{item.tradeType}</td>
                    <td>
                      <Link to={`/admin/users/${item.investorId}`} className={sh.nameLink}>
                        {item.investorName}
                      </Link>
                    </td>
                    <td className={sh.mutedCell}>{item.bidCount}</td>
                    <td><span className={s.flagReasonText}>{item.flaggedReason ?? '—'}</span></td>
                    <td className={sh.mutedCell} style={{ whiteSpace: 'nowrap' }}>
                      {fmt(item.createdAt)}
                    </td>
                    <td>
                      <button
                        className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                        onClick={() => onRemove({ id: item.id, title: item.title })}
                      >
                        <Trash2 size={11} style={{ marginRight: 4 }} />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminJobsPage() {
  const [tab,        setTab]        = useState<Tab>('all');
  const [search,     setSearch]     = useState('');
  const [dSearch,    setDSearch]    = useState('');
  const [status,     setStatus]     = useState('');
  const [tradeType,  setTradeType]  = useState('');
  const [state,      setState]      = useState('');
  const [hasDispute, setHasDispute] = useState(false);
  const [featured,   setFeatured]   = useState(false);
  const [page,       setPage]       = useState(1);
  const [removeTarget,  setRemoveTarget]  = useState<RemoveTarget | null>(null);
  const [featureTarget, setFeatureTarget] = useState<FeatureTarget | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDSearch(e.target.value); setPage(1); }, 300);
  }, []);

  function clearFilters() {
    setSearch(''); setDSearch(''); setStatus(''); setTradeType('');
    setState(''); setHasDispute(false); setFeatured(false); setPage(1);
  }

  const allParams: Record<string, unknown> = {
    page, limit: 25,
    search:     dSearch   || undefined,
    status:     status    || undefined,
    tradeType:  tradeType || undefined,
    state:      state     || undefined,
    hasDispute: hasDispute ? 'true' : undefined,
    isFeatured: featured  ? 'true' : undefined,
  };
  const noBidsParams: Record<string, unknown> = { page, limit: 25, noBidsAfterDays: 7 };
  const stuckParams:  Record<string, unknown> = { page, limit: 25, stuckInProgressDays: 14 };

  // Always call all hooks; only use the one that matches the active tab
  const allQuery    = useAdminJobs(tab === 'all'    ? allParams    : { page: 1, limit: 1 });
  const noBidsQuery = useAdminJobs(tab === 'nobids' ? noBidsParams : { page: 1, limit: 1 });
  const stuckQuery  = useAdminJobs(tab === 'stuck'  ? stuckParams  : { page: 1, limit: 1 });
  const queueQuery  = useAdminJobsContentQueue();

  const currentData = tab === 'all'    ? allQuery.data
    : tab === 'nobids' ? noBidsQuery.data
    : tab === 'stuck'  ? stuckQuery.data
    : null;

  const currentLoading = tab === 'all'    ? allQuery.isLoading
    : tab === 'nobids' ? noBidsQuery.isLoading
    : tab === 'stuck'  ? stuckQuery.isLoading
    : queueQuery.isLoading;

  const jobs       = (currentData?.data       ?? []) as AdminJob[];
  const total      = currentData?.total      ?? 0;
  const totalPages = currentData?.totalPages ?? 1;
  const queueItems = queueQuery.data ?? [];

  function switchTab(t: Tab) { setTab(t); setPage(1); }

  return (
    <div className={sh.page}>
      <AdminPageHeader
        title="Jobs"
        subtitle={`${total} total · ${queueItems.length} in content queue`}
      />

      {/* Tabs */}
      <div className={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${s.tab} ${tab === t.id ? s.tabActive : ''}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
            {t.id === 'queue' && queueItems.length > 0 && (
              <span className={s.tabCountAmber}>{queueItems.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filter bar — All tab only */}
      {tab === 'all' && (
        <div className={sh.filters}>
          <div className={s.searchWrap}>
            <Search size={14} className={s.searchIcon} />
            <input
              className={sh.searchInput}
              style={{ paddingLeft: 30 }}
              placeholder="Search title…"
              value={search}
              onChange={handleSearch}
            />
          </div>

          <select
            className={sh.filterSelect}
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">All statuses</option>
            {STATUSES.map(st => (
              <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            className={sh.filterSelect}
            value={tradeType}
            onChange={e => { setTradeType(e.target.value); setPage(1); }}
          >
            <option value="">All trades</option>
            {TRADE_TYPES.map(tt => (
              <option key={tt} value={tt}>{tt}</option>
            ))}
          </select>

          <input
            className={sh.filterSelect}
            placeholder="State (TX…)"
            value={state}
            onChange={e => { setState(e.target.value.toUpperCase()); setPage(1); }}
            style={{ width: 100 }}
          />

          <div className={s.pillGroup}>
            <button
              className={`${s.pill} ${hasDispute ? s.pillActive : ''}`}
              onClick={() => { setHasDispute(v => !v); setPage(1); }}
            >
              Has Dispute
            </button>
            <button
              className={`${s.pill} ${featured ? s.pillFeatured : ''}`}
              onClick={() => { setFeatured(v => !v); setPage(1); }}
            >
              <Star size={11} style={{ marginRight: 3 }} />
              Featured
            </button>
          </div>

          {(dSearch || status || tradeType || state || hasDispute || featured) && (
            <button className={s.clearBtn} onClick={clearFilters}>Clear</button>
          )}
        </div>
      )}

      {/* Tables */}
      {tab === 'queue' ? (
        <ContentQueueTable
          items={queueItems}
          isLoading={queueQuery.isLoading}
          onRemove={setRemoveTarget}
        />
      ) : (
        <JobsTable
          jobs={jobs}
          isLoading={currentLoading}
          onRemove={setRemoveTarget}
          onFeature={setFeatureTarget}
        />
      )}

      {/* Pagination */}
      {tab !== 'queue' && (
        <div className={sh.pagination}>
          <span>
            Showing {jobs.length ? (page - 1) * 25 + 1 : 0}–{Math.min(page * 25, total)} of {total}
          </span>
          <div className={sh.paginationBtns}>
            <button className={sh.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className={`${sh.pageBtn} ${sh.pageBtnActive}`}>{page}</button>
            <button className={sh.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}

      <RemoveJobModal target={removeTarget} onClose={() => setRemoveTarget(null)} />
      <FeatureModal   target={featureTarget} onClose={() => setFeatureTarget(null)} />
    </div>
  );
}
