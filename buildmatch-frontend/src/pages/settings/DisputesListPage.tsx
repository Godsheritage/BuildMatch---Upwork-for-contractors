import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ShieldCheck, MessageSquare, FileText, Clock, CheckCircle2, Ban } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { getDisputes, getDisputeSummary } from '../../services/dispute.service';
import type { Dispute, DisputeStatus } from '../../types/dispute.types';
import styles from './DisputesListPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCategory(cat: string): string {
  return cat
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1 day ago';
  return `${diff} days ago`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DisputeStatus,
  { label: string; bg: string; color: string }
> = {
  OPEN:               { label: 'Open',            bg: '#DBEAFE', color: '#1E40AF' },
  UNDER_REVIEW:       { label: 'Under Review',    bg: '#EDE9FE', color: '#5B21B6' },
  AWAITING_EVIDENCE:  { label: 'Evidence Needed', bg: '#FEF3C7', color: '#92400E' },
  PENDING_RULING:     { label: 'Pending Ruling',  bg: '#FFEDD5', color: '#9A3412' },
  RESOLVED:           { label: 'Resolved',        bg: '#DCFCE7', color: '#166534' },
  CLOSED:             { label: 'Closed',          bg: '#F3F4F6', color: '#374151' },
  WITHDRAWN:          { label: 'Withdrawn',       bg: '#F3F4F6', color: '#6B7280' },
};

function StatusBadge({ status }: { status: DisputeStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display:      'inline-block',
        padding:      '3px 10px',
        borderRadius: 'var(--radius-pill)',
        fontSize:     11,
        fontWeight:   'var(--font-weight-medium)' as React.CSSProperties['fontWeight'],
        letterSpacing:'0.04em',
        background:   cfg.bg,
        color:        cfg.color,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

const TABS: { key: DisputeStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',              label: 'All' },
  { key: 'OPEN',             label: 'Active' },
  { key: 'UNDER_REVIEW',     label: 'Under Review' },
  { key: 'AWAITING_EVIDENCE',label: 'Awaiting Evidence' },
  { key: 'RESOLVED',         label: 'Resolved' },
  { key: 'WITHDRAWN',        label: 'Withdrawn' },
];

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonRow}>
        <div className={styles.skeletonBadge} />
        <div className={styles.skeletonDate} />
      </div>
      <div className={styles.skeletonTitle} />
      <div className={styles.skeletonMeta} />
      <div className={styles.skeletonMeta} style={{ width: '55%' }} />
      <div className={styles.skeletonFooter}>
        <div className={styles.skeletonMeta} style={{ width: '40%' }} />
        <div className={styles.skeletonBtn} />
      </div>
    </div>
  );
}

// ── Dispute card ──────────────────────────────────────────────────────────────

function DisputeCard({ dispute, userId }: { dispute: Dispute; userId: string }) {
  const navigate   = useNavigate();
  const isFiler    = dispute.filedById === userId;
  const otherParty = isFiler ? dispute.against : dispute.filedBy;

  return (
    <div
      className={styles.card}
      onClick={() => navigate(`/dashboard/settings/disputes/${dispute.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/dashboard/settings/disputes/${dispute.id}`); }}
    >
      {/* Top row */}
      <div className={styles.cardTopRow}>
        <StatusBadge status={dispute.status} />
        <span className={styles.cardDate}>
          <Clock size={11} strokeWidth={2} style={{ marginRight: 4 }} />
          Filed {daysAgo(dispute.createdAt)}
        </span>
      </div>

      {/* Middle */}
      <div className={styles.cardMiddle}>
        <Link
          to={`/jobs/${dispute.jobId}`}
          className={styles.jobTitle}
          onClick={(e) => e.stopPropagation()}
        >
          {dispute.jobTitle}
        </Link>

        <p className={styles.categoryLabel}>{formatCategory(dispute.category)}</p>

        <p className={styles.amountLine}>
          Amount in dispute:&nbsp;
          <span className={styles.amountValue}>
            ${dispute.amountDisputed.toLocaleString()}
          </span>
        </p>

        <div className={styles.otherParty}>
          <Avatar
            name={`${otherParty.firstName} ${otherParty.lastName}`}
            src={otherParty.avatarUrl ?? undefined}
            size="sm"
          />
          <span>
            {isFiler ? 'Filed against ' : 'Filed by '}
            <strong>{otherParty.firstName} {otherParty.lastName}</strong>
          </span>
        </div>
      </div>

      {/* Bottom row */}
      <div className={styles.cardBottomRow}>
        <span className={styles.cardMeta}>
          <MessageSquare size={12} strokeWidth={2} />
          {dispute.messageCount} messages
          &nbsp;•&nbsp;
          <FileText size={12} strokeWidth={2} />
          {dispute.evidenceCount} pieces of evidence
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/dashboard/settings/disputes/${dispute.id}`);
          }}
        >
          View Details
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DisputesListPage() {
  const { user }                         = useAuth();
  const [activeTab, setActiveTab]        = useState<DisputeStatus | 'ALL'>('ALL');

  // One unfiltered fetch on mount — every tab filters the same dataset
  // client-side so switching tabs is instant.
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey:        ['disputes', 'list', 'all'],
    queryFn:         ({ pageParam = 1 }) =>
      getDisputes({ page: pageParam, limit: 25 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    refetchInterval: 60_000,
  });

  // Badge counts come from the dedicated summary endpoint so they reflect
  // the user's full dataset, not just loaded pages.
  const { data: summary } = useQuery({
    queryKey:        ['disputes', 'summary'],
    queryFn:         getDisputeSummary,
    refetchInterval: 60_000,
    staleTime:       30_000,
  });

  const fetched: Dispute[] = data?.pages.flatMap((p) => p.disputes) ?? [];

  const disputes: Dispute[] = activeTab === 'ALL'
    ? fetched
    : activeTab === 'OPEN'
      ? fetched.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW')
      : fetched.filter((d) => d.status === activeTab);

  function tabCount(key: DisputeStatus | 'ALL'): number | null {
    if (!summary) return null;
    switch (key) {
      case 'ALL':               return summary.total            || null;
      case 'OPEN':              return summary.active           || null;
      case 'UNDER_REVIEW':      return summary.underReview      || null;
      case 'AWAITING_EVIDENCE': return summary.awaitingEvidence || null;
      case 'PENDING_RULING':    return summary.pendingRuling    || null;
      case 'RESOLVED':          return summary.resolved         || null;
      case 'CLOSED':            return summary.closed           || null;
      case 'WITHDRAWN':         return summary.withdrawn        || null;
      default:                  return null;
    }
  }

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dispute Resolution Centre</h1>
          <p className={styles.subtitle}>Manage disputes on your active and completed jobs</p>
        </div>
        <Button
          variant="primary"
          onClick={() => window.location.href = '/dashboard/settings/disputes/new'}
        >
          File a Dispute
        </Button>
      </div>

      {/* Filter tabs */}
      <div className={styles.tabs} role="tablist">
        {TABS.map((tab) => {
          const count = tabCount(tab.key);
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              className={[styles.tab, activeTab === tab.key ? styles.tabActive : ''].join(' ')}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {count !== null && count > 0 && (
                <span className={[styles.tabBadge, activeTab === tab.key ? styles.tabBadgeActive : ''].join(' ')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className={styles.list}>
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : disputes.length === 0 ? (
          activeTab === 'AWAITING_EVIDENCE' ? (
            <div className={styles.empty}>
              <FileText size={48} strokeWidth={1.25} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>No evidence requests</p>
              <p className={styles.emptySub}>
                You'll see disputes here when an admin requests additional evidence from you.
              </p>
            </div>
          ) : activeTab === 'RESOLVED' ? (
            <div className={styles.empty}>
              <CheckCircle2 size={48} strokeWidth={1.25} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>You have no resolved disputes yet</p>
            </div>
          ) : activeTab === 'WITHDRAWN' ? (
            <div className={styles.empty}>
              <Ban size={48} strokeWidth={1.25} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>You have no withdrawn disputes yet</p>
            </div>
          ) : (
            <div className={styles.empty}>
              <ShieldCheck size={48} strokeWidth={1.25} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>No disputes on your account</p>
              <p className={styles.emptySub}>
                If you have an issue with a job, you can file a dispute below.
              </p>
              <Button
                variant="primary"
                onClick={() => window.location.href = '/dashboard/settings/disputes/new'}
              >
                File a Dispute
              </Button>
            </div>
          )
        ) : (
          <>
            {disputes.map((d) => (
              <DisputeCard key={d.id} dispute={d} userId={user?.id ?? ''} />
            ))}
            {activeTab === 'ALL' && hasNextPage && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <Button
                  variant="secondary"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
