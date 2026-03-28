import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, MapPin, MessageSquare, ChevronRight, Calendar,
  TrendingUp, CheckCircle2, Clock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getMyBids } from '../services/job.service';
import { getOrCreateConversation } from '../services/message.service';
import { useToast } from '../context/ToastContext';
import type { BidStatus } from '../types/job.types';
import type { BidWithJob } from '../services/job.service';
import styles from './MyBidsPage.module.css';

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BidStatus, {
  bg:     string;
  color:  string;
  label:  string;
  accent: string;
}> = {
  PENDING:   { bg: '#FEF9C3', color: '#854D0E', label: 'Pending',   accent: '#F59E0B' },
  ACCEPTED:  { bg: '#DCFCE7', color: '#166534', label: 'Accepted',  accent: '#22C55E' },
  REJECTED:  { bg: '#FEE2E2', color: '#991B1B', label: 'Not selected', accent: '#EF4444' },
  WITHDRAWN: { bg: '#F3F4F6', color: '#6B7280', label: 'Withdrawn', accent: '#D1D5DB' },
};

function StatusBadge({ status }: { status: BidStatus }) {
  const s = STATUS_CONFIG[status];
  return (
    <span className={styles.badge} style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Bid card ──────────────────────────────────────────────────────────────────

function BidCard({ bid }: { bid: BidWithJob }) {
  const navigate  = useNavigate();
  const { toast } = useToast();
  const [messaging, setMessaging] = useState(false);

  const s          = STATUS_CONFIG[bid.status];
  const isAccepted = bid.status === 'ACCEPTED';
  const isPending  = bid.status === 'PENDING';

  const submittedDate = new Date(bid.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  async function handleMessage(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!bid.job?.investorId || messaging) return;
    setMessaging(true);
    try {
      const conv = await getOrCreateConversation(bid.jobId, bid.job.investorId);
      navigate(`/dashboard/messages/${conv.id}`);
    } catch {
      toast('Could not open conversation. Please try again.', 'error');
    } finally {
      setMessaging(false);
    }
  }

  return (
    <Link
      to={`/jobs/${bid.jobId}`}
      className={`${styles.card} ${isAccepted ? styles.cardAccepted : ''}`}
    >
      {/* Left accent bar */}
      <div className={styles.accentBar} style={{ background: s.accent }} />

      <div className={styles.cardBody}>
        {/* Accepted banner */}
        {isAccepted && (
          <div className={styles.acceptedBanner}>
            <CheckCircle2 size={13} strokeWidth={2.5} />
            <span>Your bid was accepted — you got the job!</span>
          </div>
        )}

        {/* Main row */}
        <div className={styles.mainRow}>
          <div className={styles.mainLeft}>
            <p className={styles.jobTitle}>{bid.job?.title ?? 'Job removed'}</p>
            <div className={styles.metaRow}>
              {bid.job?.city && (
                <span className={styles.metaItem}>
                  <MapPin size={11} strokeWidth={1.75} />
                  {bid.job.city}, {bid.job.state}
                </span>
              )}
              <span className={styles.metaItem}>
                <Calendar size={11} strokeWidth={1.75} />
                {submittedDate}
              </span>
            </div>
          </div>

          <div className={styles.mainRight}>
            <p className={styles.bidAmount}>${bid.amount.toLocaleString()}</p>
            <p className={styles.bidAmountLabel}>your bid</p>
          </div>
        </div>

        {/* Footer row */}
        <div className={styles.footerRow}>
          <div className={styles.footerLeft}>
            <StatusBadge status={bid.status} />
            {isPending && (
              <span className={styles.pendingHint}>
                <Clock size={11} strokeWidth={1.75} />
                Awaiting investor decision
              </span>
            )}
          </div>
          <div className={styles.footerRight}>
            {isAccepted && (
              <button
                className={styles.msgBtn}
                disabled={messaging}
                onClick={handleMessage}
              >
                <MessageSquare size={12} strokeWidth={2} />
                {messaging ? 'Opening…' : 'Message Investor'}
              </button>
            )}
            <span className={styles.viewLink}>
              View job
              <ChevronRight size={13} strokeWidth={2} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className={styles.card} style={{ pointerEvents: 'none' }}>
      <div className={styles.accentBar} style={{ background: 'var(--color-border)' }} />
      <div className={styles.cardBody}>
        <div className={styles.mainRow}>
          <div className={styles.mainLeft}>
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonMeta} />
          </div>
          <div className={styles.skeletonAmount} />
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <FileText size={24} strokeWidth={1.5} color="var(--color-text-muted)" />
      </div>
      <p className={styles.emptyTitle}>No bids yet</p>
      <p className={styles.emptyDesc}>
        Browse open jobs and submit your first bid to get started.
      </p>
      <Link to="/dashboard/browse-jobs" className={styles.emptyBtn}>
        Browse jobs
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MyBidsPage() {
  const { data: bids, isLoading } = useQuery({
    queryKey: ['bids', 'my-bids'],
    queryFn:  getMyBids,
  });

  const total    = bids?.length ?? 0;
  const accepted = bids?.filter((b) => b.status === 'ACCEPTED').length ?? 0;
  const pending  = bids?.filter((b) => b.status === 'PENDING').length  ?? 0;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <TrendingUp size={18} strokeWidth={1.75} color="var(--color-primary)" />
        </div>
        <div>
          <h1 className={styles.title}>My Bids</h1>
          <p className={styles.subtitle}>Track and manage all the jobs you've bid on.</p>
        </div>
      </div>

      {/* Stats bar — only when data is loaded and there are bids */}
      {!isLoading && total > 0 && (
        <div className={styles.statsBar}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{total}</span>
            <span className={styles.statLabel}>Total Bids</span>
          </div>
          <div className={styles.statDiv} />
          <div className={styles.stat}>
            <span className={styles.statNum} style={{ color: '#166534' }}>{accepted}</span>
            <span className={styles.statLabel}>Accepted</span>
          </div>
          <div className={styles.statDiv} />
          <div className={styles.stat}>
            <span className={styles.statNum} style={{ color: '#854D0E' }}>{pending}</span>
            <span className={styles.statLabel}>Pending</span>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className={styles.cardList}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : !bids?.length ? (
        <EmptyState />
      ) : (
        <div className={styles.cardList}>
          {bids.map((bid) => (
            <BidCard key={bid.id} bid={bid} />
          ))}
        </div>
      )}

    </div>
  );
}
