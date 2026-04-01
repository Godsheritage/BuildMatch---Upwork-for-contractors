import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminDisputes } from '../../hooks/useAdmin';
import sh from './admin-shared.module.css';
import s from './AdminDisputesPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

function statusBadge(status: string | undefined | null) {
  if (!status) return null;
  const map: Record<string, string> = {
    OPEN:              sh.badgeOpen,
    UNDER_REVIEW:      sh.badgeInProgress,
    AWAITING_EVIDENCE: sh.badgeInProgress,
    PENDING_RULING:    sh.badgeInProgress,
    RESOLVED:          sh.badgeCompleted,
    CLOSED:            sh.badgeWithdrawn,
    WITHDRAWN:         sh.badgeWithdrawn,
  };
  return (
    <span className={`${sh.badge} ${map[status] ?? ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function DaysOpenBadge({ days }: { days: number }) {
  const cls = days > 7 ? s.daysRed : days >= 3 ? s.daysAmber : s.daysGreen;
  return <span className={`${s.daysBadge} ${cls}`}>{days}d</span>;
}

// ── Tab configuration ─────────────────────────────────────────────────────────

type Tab = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ALL';

const TABS: { key: Tab; label: string }[] = [
  { key: 'OPEN',         label: 'Open' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'RESOLVED',     label: 'Resolved' },
  { key: 'ALL',          label: 'All' },
];

// ── Row skeleton ──────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className={sh.skeletonRow}>
          {[180, 120, 120, 72, 56, 72, 64].map((w, j) => (
            <td key={j}><div className={sh.skeletonLine} style={{ width: w }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminDisputesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('OPEN');
  const [page, setPage]           = useState(1);
  const LIMIT = 25;

  const params = {
    page,
    limit: LIMIT,
    status: activeTab === 'ALL' ? undefined : activeTab,
  };

  const { data, isLoading } = useAdminDisputes(params);

  // Parallel count queries for tab badges
  const { data: openData }   = useAdminDisputes({ page: 1, limit: 1, status: 'OPEN' });
  const { data: reviewData } = useAdminDisputes({ page: 1, limit: 1, status: 'UNDER_REVIEW' });

  const disputes   = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const openCount  = openData?.total   ?? 0;
  const reviewCount = reviewData?.total ?? 0;

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    setPage(1);
  }

  const subtitle = `${openCount} open • ${reviewCount} under review`;

  return (
    <div className={sh.page}>
      {/* Header */}
      <div className={sh.pageHeader}>
        <div>
          <h1 className={sh.pageTitle}>Disputes</h1>
          <p className={sh.pageSubtitle}>{subtitle}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className={s.tabs}>
        {TABS.map(t => {
          const count = t.key === 'OPEN' ? openCount : t.key === 'UNDER_REVIEW' ? reviewCount : null;
          return (
            <button
              key={t.key}
              className={`${s.tab} ${activeTab === t.key ? s.tabActive : ''}`}
              onClick={() => handleTabChange(t.key)}
            >
              {t.label}
              {count !== null && count > 0 && (
                <span className={s.tabCount}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Job</th>
              <th>Filed By</th>
              <th>Other Party</th>
              <th>Amount</th>
              <th>Days Open</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows />
            ) : disputes.length === 0 ? (
              <tr className={sh.emptyRow}>
                <td colSpan={7}>
                  No {activeTab === 'ALL' ? '' : activeTab.replace(/_/g, ' ').toLowerCase() + ' '}disputes found
                </td>
              </tr>
            ) : disputes.map(d => (
              <tr key={d.id}>
                <td>
                  <div className={s.jobCell}>
                    <span className={s.jobTitle}>{d.jobTitle || '—'}</span>
                    <span className={s.jobMeta}>Milestone #{d.milestoneDraw}</span>
                  </div>
                </td>
                <td>
                  <div className={s.partyName}>{d.filedByName || '—'}</div>
                </td>
                <td>
                  <div className={s.partyName}>{d.otherPartyName || '—'}</div>
                </td>
                <td>
                  <span className={s.amount}>{fmtUsd(d.amountDisputed)}</span>
                </td>
                <td>
                  <DaysOpenBadge days={d.daysOpen} />
                </td>
                <td>{statusBadge(d.status)}</td>
                <td>
                  <button
                    className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
                    onClick={() => navigate(`/admin/disputes/${d.id}`)}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className={sh.pagination}>
            <span>
              Showing {disputes.length ? (page - 1) * LIMIT + 1 : 0}–{Math.min(page * LIMIT, total)} of {total}
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
        )}
      </div>
    </div>
  );
}
