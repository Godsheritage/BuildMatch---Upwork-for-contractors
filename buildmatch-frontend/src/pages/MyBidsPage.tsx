import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, ChevronRight, MapPin, DollarSign, MessageSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getMyBids } from '../services/job.service';
import { getOrCreateConversation } from '../services/message.service';
import { useToast } from '../context/ToastContext';
import type { BidStatus } from '../types/job.types';
import type { BidWithJob } from '../services/job.service';
import styles from './MyBidsPage.module.css';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BidStatus, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: '#FEF9C3', color: '#854D0E', label: 'Pending'   },
  ACCEPTED:  { bg: '#DCFCE7', color: '#166534', label: 'Accepted'  },
  REJECTED:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected'  },
  WITHDRAWN: { bg: '#F3F4F6', color: '#374151', label: 'Withdrawn' },
};

function StatusBadge({ status }: { status: BidStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span style={{ background: s.bg, color: s.color }} className={styles.badge}>
      {s.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function BidRow({ bid }: { bid: BidWithJob }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messaging, setMessaging] = useState(false);

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
    <Link key={bid.id} to={`/jobs/${bid.jobId}`} className={styles.row}>
      <div className={styles.rowMain}>
        <p className={styles.jobTitle}>{bid.job?.title ?? 'Job removed'}</p>
        <div className={styles.meta}>
          {bid.job?.city && (
            <span className={styles.metaItem}>
              <MapPin size={12} strokeWidth={1.75} />
              {bid.job.city}, {bid.job.state}
            </span>
          )}
          <span className={styles.metaItem}>
            <DollarSign size={12} strokeWidth={1.75} />
            Your bid: ${bid.amount.toLocaleString()}
          </span>
          <span className={styles.metaItem}>
            {new Date(bid.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
      <div className={styles.rowRight}>
        {bid.status === 'ACCEPTED' && (
          <button
            className={styles.msgBtn}
            disabled={messaging}
            onClick={handleMessage}
            title="Message Investor"
          >
            <MessageSquare size={13} strokeWidth={2} />
            {messaging ? '…' : 'Message'}
          </button>
        )}
        <StatusBadge status={bid.status} />
        <ChevronRight size={15} strokeWidth={1.75} color="var(--color-text-muted)" />
      </div>
    </Link>
  );
}

export function MyBidsPage() {
  const { data: bids, isLoading } = useQuery({
    queryKey: ['bids', 'my-bids'],
    queryFn:  getMyBids,
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Bids</h1>
        <p className={styles.subtitle}>Track all the jobs you've bid on.</p>
      </div>

      {isLoading ? (
        <div className={styles.list}>
          {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : !bids?.length ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <FileText size={24} strokeWidth={1.5} color="var(--color-text-muted)" />
          </div>
          <p className={styles.emptyTitle}>No bids yet</p>
          <p className={styles.emptyDesc}>Browse open jobs and submit your first bid to get started.</p>
          <Link to="/jobs" className={styles.emptyLink}>Browse jobs</Link>
        </div>
      ) : (
        <div className={styles.list}>
          {bids.map((bid) => (
            <BidRow key={bid.id} bid={bid} />
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className={styles.row} style={{ pointerEvents: 'none' }}>
      <div className={styles.rowMain}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonMeta} />
      </div>
    </div>
  );
}
