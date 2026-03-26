import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MoreVertical, AlertTriangle, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { getMyJobs, cancelJob } from '../services/job.service';
import { Button } from '../components/ui/Button';
import type { JobPost, JobStatus } from '../types/job.types';
import styles from './InvestorJobsPage.module.css';

// ── Constants ──────────────────────────────────────────────────────────────────

const TRADE_LABELS: Record<string, string> = {
  GENERAL: 'General', ELECTRICAL: 'Electrical', PLUMBING: 'Plumbing',
  HVAC: 'HVAC', ROOFING: 'Roofing', FLOORING: 'Flooring', PAINTING: 'Painting',
  LANDSCAPING: 'Landscaping', DEMOLITION: 'Demolition', OTHER: 'Other',
};

const STATUS_META: Record<JobStatus, { label: string; bg: string; text: string }> = {
  OPEN:        { label: 'Open',        bg: '#DCFCE7', text: '#166534' },
  AWARDED:     { label: 'Awarded',     bg: '#DBEAFE', text: '#1E40AF' },
  IN_PROGRESS: { label: 'In Progress', bg: '#FEF9C3', text: '#854D0E' },
  COMPLETED:   { label: 'Completed',   bg: '#F3F4F6', text: '#374151' },
  CANCELLED:   { label: 'Cancelled',   bg: '#FEE2E2', text: '#991B1B' },
};

const TABS: { key: 'ALL' | JobStatus; label: string }[] = [
  { key: 'ALL',         label: 'All'         },
  { key: 'OPEN',        label: 'Open'        },
  { key: 'AWARDED',     label: 'Awarded'     },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED',   label: 'Completed'   },
  { key: 'CANCELLED',   label: 'Cancelled'   },
];

// ── Utilities ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        {/* Inline SVG: clipboard with dashed border */}
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="14" width="32" height="32" rx="4" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="4 3"/>
          <rect x="18" y="8" width="16" height="10" rx="3" fill="#F9FAFB" stroke="#D1D5DB" strokeWidth="2"/>
          <path d="M18 27h16M18 33h10" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <p className={styles.emptyTitle}>
        {filtered ? 'No jobs in this category' : 'You have not posted any jobs yet.'}
      </p>
      {!filtered && (
        <>
          <p className={styles.emptySubtitle}>
            Post your first job to start receiving bids from qualified contractors.
          </p>
          <Link to="/dashboard/post-job">
            <Button variant="primary">Post your first job</Button>
          </Link>
        </>
      )}
    </div>
  );
}

// ── Confirm cancel dialog (lightweight overlay) ────────────────────────────────

function CancelConfirmDialog({
  job,
  onConfirm,
  onClose,
  isPending,
}: {
  job: JobPost;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <div className={styles.dialogBackdrop} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHeader}>
          <div className={styles.dialogIconWrap}>
            <AlertTriangle size={18} color="var(--color-warning)" strokeWidth={2} />
          </div>
          <button className={styles.dialogClose} onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <h3 className={styles.dialogTitle}>Cancel this job?</h3>
        <p className={styles.dialogBody}>
          <strong>{job.title}</strong> will be marked as cancelled and removed from
          active listings. This cannot be undone.
        </p>
        <div className={styles.dialogActions}>
          <button className={styles.dialogCancelBtn} onClick={onClose} disabled={isPending}>
            Keep Job
          </button>
          <button className={styles.dialogConfirmBtn} onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Cancelling…' : 'Yes, Cancel Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kebab menu ────────────────────────────────────────────────────────────────

function KebabMenu({
  job,
  onCancel,
}: {
  job: JobPost;
  onCancel: (job: JobPost) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} className={styles.kebabWrap} onClick={(e) => e.stopPropagation()}>
      <button
        className={styles.kebabBtn}
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
      >
        <MoreVertical size={15} strokeWidth={2} />
      </button>
      {open && (
        <div className={styles.kebabMenu}>
          <Link
            to={`/jobs/${job.id}`}
            className={styles.kebabItem}
            onClick={() => setOpen(false)}
          >
            Edit job
          </Link>
          <button
            className={`${styles.kebabItem} ${styles.kebabItemDanger}`}
            onClick={() => { setOpen(false); onCancel(job); }}
          >
            Cancel job
          </button>
        </div>
      )}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.OPEN;
  return (
    <span
      className={styles.statusBadge}
      style={{ background: meta.bg, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows() {
  const block = (w: number | string) => (
    <div className={styles.skeletonBlock} style={{ width: w, height: 14, borderRadius: 3 }} />
  );
  return (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i} className={styles.skeletonRow}>
          <td><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{block('70%')}{block('40%')}</div></td>
          <td>{block(60)}</td>
          <td>{block(80)}</td>
          <td>{block(24)}</td>
          <td>{block(64)}</td>
          <td>{block(72)}</td>
          <td>{block(56)}</td>
        </tr>
      ))}
    </>
  );
}

// ── Mobile job card ───────────────────────────────────────────────────────────

function MobileJobCard({
  job,
  onCancel,
}: {
  job: JobPost;
  onCancel: (job: JobPost) => void;
}) {
  const navigate = useNavigate();
  return (
    <div className={styles.mobileCard} onClick={() => navigate(`/jobs/${job.id}`)}>
      <div className={styles.mobileCardHeader}>
        <div className={styles.mobileCardTitle}>
          <p className={styles.mobileCardName}>{job.title}</p>
          <p className={styles.mobileCardTrade}>{TRADE_LABELS[job.tradeType] ?? job.tradeType}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <div className={styles.mobileCardMeta}>
        <span>${job.budgetMin.toLocaleString()}–${job.budgetMax.toLocaleString()}</span>
        <span className={styles.mobileMetaDot}>·</span>
        <span>{job.bidCount} bid{job.bidCount !== 1 ? 's' : ''}</span>
        <span className={styles.mobileMetaDot}>·</span>
        <span>{formatDate(job.createdAt)}</span>
      </div>
      <div className={styles.mobileCardActions} onClick={(e) => e.stopPropagation()}>
        <Link to={`/jobs/${job.id}`} className={styles.mobileActionBtn}>
          View{job.status === 'OPEN' ? ' Bids' : ''}
        </Link>
        {job.status === 'OPEN' && (
          <button
            className={`${styles.mobileActionBtn} ${styles.mobileActionDanger}`}
            onClick={() => onCancel(job)}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function InvestorJobsPage() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const { toast } = useToast();
  const [activeTab,     setActiveTab]     = useState<'ALL' | JobStatus>('ALL');
  const [cancelTarget,  setCancelTarget]  = useState<JobPost | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs', 'my-jobs'],
    queryFn:  getMyJobs,
    staleTime: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (job: JobPost) => cancelJob(job.id),
    onSuccess: () => {
      toast('Job cancelled.');
      qc.invalidateQueries({ queryKey: ['jobs', 'my-jobs'] });
      setCancelTarget(null);
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to cancel job', 'error');
    },
  });

  const handleCancel = useCallback((job: JobPost) => setCancelTarget(job), []);

  // Tab counts
  const counts = TABS.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.key] = tab.key === 'ALL'
      ? jobs.length
      : jobs.filter((j) => j.status === tab.key).length;
    return acc;
  }, {});

  const filtered = activeTab === 'ALL' ? jobs : jobs.filter((j) => j.status === activeTab);

  return (
    <div className={styles.page}>

      {/* ── Page header ────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Jobs</h1>
          <p className={styles.subtitle}>
            {isLoading ? '…' : `${jobs.length} total job${jobs.length !== 1 ? 's' : ''} posted`}
          </p>
        </div>
        <Link to="/dashboard/post-job">
          <Button variant="primary">Post a New Job</Button>
        </Link>
      </div>

      {/* ── Tabs ───────────────────────────────────────── */}
      <div className={styles.tabsWrap}>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {!isLoading && counts[tab.key] > 0 && (
                <span
                  className={`${styles.tabCount} ${activeTab === tab.key ? styles.tabCountActive : ''}`}
                >
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table (desktop) ────────────────────────────── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>Job Title</th>
              <th className={styles.th}>Trade</th>
              <th className={styles.th}>Budget</th>
              <th className={styles.th}>Bids</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Posted</th>
              <th className={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  <EmptyState filtered={activeTab !== 'ALL'} />
                </td>
              </tr>
            ) : (
              filtered.map((job) => (
                <tr
                  key={job.id}
                  className={styles.row}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  {/* Title */}
                  <td className={styles.td}>
                    <p className={styles.jobTitle}>{job.title}</p>
                    <p className={styles.jobLocation}>
                      {[job.city, job.state].filter(Boolean).join(', ') || '—'}
                    </p>
                  </td>

                  {/* Trade */}
                  <td className={styles.td}>
                    <span className={styles.tradeChip}>
                      {TRADE_LABELS[job.tradeType] ?? job.tradeType}
                    </span>
                  </td>

                  {/* Budget */}
                  <td className={`${styles.td} ${styles.tdBudget}`}>
                    ${job.budgetMin.toLocaleString()}–${job.budgetMax.toLocaleString()}
                  </td>

                  {/* Bids */}
                  <td className={`${styles.td} ${styles.tdCenter}`}>
                    <span className={job.bidCount > 0 ? styles.bidCountActive : styles.bidCount}>
                      {job.bidCount}
                    </span>
                  </td>

                  {/* Status */}
                  <td className={styles.td}>
                    <StatusBadge status={job.status} />
                  </td>

                  {/* Posted */}
                  <td className={`${styles.td} ${styles.tdMuted}`}>
                    {formatDate(job.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.actionsCell}>
                      <Link
                        to={`/jobs/${job.id}`}
                        className={styles.viewBtn}
                      >
                        {job.status === 'OPEN' ? 'View Bids' : 'View'}
                      </Link>
                      {job.status === 'OPEN' && (
                        <KebabMenu job={job} onCancel={handleCancel} />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile card list ────────────────────────────── */}
      <div className={styles.mobileList}>
        {isLoading ? (
          <div className={styles.mobileLoading}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.mobileCardSkeleton} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filtered={activeTab !== 'ALL'} />
        ) : (
          filtered.map((job) => (
            <MobileJobCard key={job.id} job={job} onCancel={handleCancel} />
          ))
        )}
      </div>

      {/* ── Cancel confirm dialog ───────────────────────── */}
      {cancelTarget && (
        <CancelConfirmDialog
          job={cancelTarget}
          onConfirm={() => cancelMutation.mutate(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          isPending={cancelMutation.isPending}
        />
      )}
    </div>
  );
}
