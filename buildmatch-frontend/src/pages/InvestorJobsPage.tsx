import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MoreVertical, AlertTriangle, X, MessageSquare } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { useLang } from '../context/LanguageContext';
import { getMyJobs, cancelJob, getJobBids } from '../services/job.service';
import { getOrCreateConversation } from '../services/message.service';
import { Button } from '../components/ui/Button';
import type { JobPost, JobStatus } from '../types/job.types';
import styles from './InvestorJobsPage.module.css';

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<JobStatus, { bg: string; text: string }> = {
  OPEN:        { bg: '#DCFCE7', text: '#166534' },
  AWARDED:     { bg: '#DBEAFE', text: '#1E40AF' },
  IN_PROGRESS: { bg: '#FEF9C3', text: '#854D0E' },
  COMPLETED:   { bg: '#F3F4F6', text: '#374151' },
  CANCELLED:   { bg: '#FEE2E2', text: '#991B1B' },
};

const TAB_KEYS = ['ALL', 'OPEN', 'AWARDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
type TabKey = typeof TAB_KEYS[number];

// ── Utilities ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useLang();
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="14" width="32" height="32" rx="4" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="4 3"/>
          <rect x="18" y="8" width="16" height="10" rx="3" fill="#F9FAFB" stroke="#D1D5DB" strokeWidth="2"/>
          <path d="M18 27h16M18 33h10" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <p className={styles.emptyTitle}>
        {filtered ? t.investorJobs.empty.title : t.investorJobs.empty.desc}
      </p>
      {!filtered && (
        <>
          <p className={styles.emptySubtitle}>{t.investorJobs.empty.desc2}</p>
          <Link to="/dashboard/post-job">
            <Button variant="primary">{t.investorJobs.empty.cta}</Button>
          </Link>
        </>
      )}
    </div>
  );
}

// ── Confirm cancel dialog ──────────────────────────────────────────────────────

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
  const { t } = useLang();
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
        <h3 className={styles.dialogTitle}>{t.investorJobs.cancelDialog.title}</h3>
        <p className={styles.dialogBody}>
          <strong>{job.title}</strong> {t.investorJobs.cancelDialog.body}
        </p>
        <div className={styles.dialogActions}>
          <button className={styles.dialogCancelBtn} onClick={onClose} disabled={isPending}>
            {t.investorJobs.cancelDialog.keepBtn}
          </button>
          <button className={styles.dialogConfirmBtn} onClick={onConfirm} disabled={isPending}>
            {isPending ? t.investorJobs.cancelDialog.loading : t.investorJobs.cancelDialog.confirmBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kebab menu ────────────────────────────────────────────────────────────────

function KebabMenu({ job, onCancel }: { job: JobPost; onCancel: (job: JobPost) => void }) {
  const { t } = useLang();
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
            {t.investorJobs.actions.editJob}
          </Link>
          <button
            className={`${styles.kebabItem} ${styles.kebabItemDanger}`}
            onClick={() => { setOpen(false); onCancel(job); }}
          >
            {t.investorJobs.actions.cancelJob}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobStatus }) {
  const { t } = useLang();
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.OPEN;
  return (
    <span
      className={styles.statusBadge}
      style={{ background: colors.bg, color: colors.text }}
    >
      {t.status[status as keyof typeof t.status] ?? status}
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
  job, onCancel, onMessage, isMessaging,
}: {
  job: JobPost;
  onCancel: (job: JobPost) => void;
  onMessage: (jobId: string) => void;
  isMessaging: boolean;
}) {
  const { t } = useLang();
  const navigate = useNavigate();
  return (
    <div className={styles.mobileCard} onClick={() => navigate(`/jobs/${job.id}`)}>
      <div className={styles.mobileCardHeader}>
        <div className={styles.mobileCardTitle}>
          <p className={styles.mobileCardName}>{job.title}</p>
          <p className={styles.mobileCardTrade}>
            {t.specialties[job.tradeType as keyof typeof t.specialties] ?? job.tradeType}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      <div className={styles.mobileCardMeta}>
        <span>${job.budgetMin.toLocaleString()}–${job.budgetMax.toLocaleString()}</span>
        <span className={styles.mobileMetaDot}>·</span>
        <span>{job.bidCount} {t.investorJobs.mobileBids}</span>
        <span className={styles.mobileMetaDot}>·</span>
        <span>{formatDate(job.createdAt)}</span>
      </div>
      <div className={styles.mobileCardActions} onClick={(e) => e.stopPropagation()}>
        <Link to={`/jobs/${job.id}`} className={styles.mobileActionBtn}>
          {job.status === 'OPEN' ? t.investorJobs.actions.viewBids : t.investorJobs.actions.view}
        </Link>
        {(job.status === 'AWARDED' || job.status === 'IN_PROGRESS') && (
          <button
            className={styles.mobileActionBtn}
            disabled={isMessaging}
            onClick={() => onMessage(job.id)}
          >
            {isMessaging ? '…' : 'Message'}
          </button>
        )}
        {job.status === 'OPEN' && (
          <button
            className={`${styles.mobileActionBtn} ${styles.mobileActionDanger}`}
            onClick={() => onCancel(job)}
          >
            {t.investorJobs.actions.cancelJob}
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
  const { t }     = useLang();
  const [activeTab,    setActiveTab]    = useState<TabKey>('ALL');
  const [cancelTarget, setCancelTarget] = useState<JobPost | null>(null);
  const [messagingJobId, setMessagingJobId] = useState<string | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs', 'my-jobs'],
    queryFn:  getMyJobs,
    staleTime: 30_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (job: JobPost) => cancelJob(job.id),
    onSuccess: () => {
      toast(t.investorJobs.toast.cancelled);
      qc.invalidateQueries({ queryKey: ['jobs', 'my-jobs'] });
      setCancelTarget(null);
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to cancel job', 'error');
    },
  });

  const handleCancel = useCallback((job: JobPost) => setCancelTarget(job), []);

  const handleMessageContractor = useCallback(async (jobId: string) => {
    setMessagingJobId(jobId);
    try {
      const bids = await getJobBids(jobId);
      const accepted = bids.find((b) => b.status === 'ACCEPTED');
      if (!accepted?.contractor?.userId) {
        navigate(`/jobs/${jobId}`);
        return;
      }
      const conv = await getOrCreateConversation(jobId, accepted.contractor.userId);
      navigate(`/dashboard/messages/${conv.id}`);
    } catch {
      toast('Could not open conversation. Please try again.', 'error');
    } finally {
      setMessagingJobId(null);
    }
  }, [navigate, toast]);

  const counts = TAB_KEYS.reduce<Record<string, number>>((acc, key) => {
    acc[key] = key === 'ALL'
      ? jobs.length
      : jobs.filter((j) => j.status === key).length;
    return acc;
  }, {});

  const filtered = activeTab === 'ALL' ? jobs : jobs.filter((j) => j.status === activeTab);

  return (
    <div className={styles.page}>

      {/* ── Page header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.investorJobs.title}</h1>
          <p className={styles.subtitle}>
            {isLoading ? '…' : `${jobs.length} ${t.investorJobs.totalPosted}`}
          </p>
        </div>
        <Link to="/dashboard/post-job">
          <Button variant="primary">{t.investorJobs.postNew}</Button>
        </Link>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabsWrap}>
        <div className={styles.tabs}>
          {TAB_KEYS.map((key) => {
            const label = key === 'ALL'
              ? t.investorJobs.tabs.ALL
              : t.investorJobs.tabs[key as keyof typeof t.investorJobs.tabs] ?? key;
            return (
              <button
                key={key}
                className={`${styles.tab} ${activeTab === key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
                {!isLoading && counts[key] > 0 && (
                  <span className={`${styles.tabCount} ${activeTab === key ? styles.tabCountActive : ''}`}>
                    {counts[key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Table (desktop) ── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>{t.investorJobs.table.title}</th>
              <th className={styles.th}>{t.investorJobs.table.trade}</th>
              <th className={styles.th}>{t.investorJobs.table.budget}</th>
              <th className={styles.th}>{t.investorJobs.table.bids}</th>
              <th className={styles.th}>{t.investorJobs.table.status}</th>
              <th className={styles.th}>{t.investorJobs.table.posted}</th>
              <th className={styles.th}>{t.investorJobs.table.actions}</th>
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
                  <td className={styles.td}>
                    <p className={styles.jobTitle}>{job.title}</p>
                    <p className={styles.jobLocation}>
                      {[job.city, job.state].filter(Boolean).join(', ') || '—'}
                    </p>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.tradeChip}>
                      {t.specialties[job.tradeType as keyof typeof t.specialties] ?? job.tradeType}
                    </span>
                  </td>
                  <td className={`${styles.td} ${styles.tdBudget}`}>
                    ${job.budgetMin.toLocaleString()}–${job.budgetMax.toLocaleString()}
                  </td>
                  <td className={`${styles.td} ${styles.tdCenter}`}>
                    <span className={job.bidCount > 0 ? styles.bidCountActive : styles.bidCount}>
                      {job.bidCount}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <StatusBadge status={job.status} />
                  </td>
                  <td className={`${styles.td} ${styles.tdMuted}`}>
                    {formatDate(job.createdAt)}
                  </td>
                  <td className={styles.tdActions} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.actionsCell}>
                      <Link to={`/jobs/${job.id}`} className={styles.viewBtn}>
                        {job.status === 'OPEN' ? t.investorJobs.actions.viewBids : t.investorJobs.actions.view}
                      </Link>
                      {(job.status === 'AWARDED' || job.status === 'IN_PROGRESS') && (
                        <button
                          className={styles.viewBtn}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 12 }}
                          disabled={messagingJobId === job.id}
                          onClick={() => handleMessageContractor(job.id)}
                        >
                          <MessageSquare size={12} strokeWidth={2} />
                          {messagingJobId === job.id ? '…' : 'Message'}
                        </button>
                      )}
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

      {/* ── Mobile card list ── */}
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
            <MobileJobCard
              key={job.id}
              job={job}
              onCancel={handleCancel}
              onMessage={handleMessageContractor}
              isMessaging={messagingJobId === job.id}
            />
          ))
        )}
      </div>

      {/* ── Cancel confirm dialog ── */}
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
