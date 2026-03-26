import React, { useState, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Calendar, DollarSign, Briefcase,
  Users, AlertTriangle, CheckCircle2, Star,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import {
  getJobById, getJobBids, getMyBid,
  createBid, acceptBid, withdrawBid, cancelJob,
  getJobMessages, sendJobMessage,
} from '../services/job.service';
import { polishReply, summarizeThread } from '../services/ai.service';
import { ReviewModal } from '../components/review/ReviewModal';
import { StarRating } from '../components/ui/StarRating';
import { Button } from '../components/ui/Button';
import type { BidWithContractor, JobPost, Message } from '../types/job.types';
import styles from './JobDetailPage.module.css';

// ── Constants ──────────────────────────────────────────────────────────────────

const TRADE_LABELS: Record<string, string> = {
  GENERAL: 'General Contractor', ELECTRICAL: 'Electrical', PLUMBING: 'Plumbing',
  HVAC: 'HVAC', ROOFING: 'Roofing', FLOORING: 'Flooring', PAINTING: 'Painting',
  LANDSCAPING: 'Landscaping', DEMOLITION: 'Demolition', OTHER: 'Other Trade',
};

const TRADE_COLORS: Record<string, { bg: string; text: string }> = {
  GENERAL:     { bg: '#EFF6FF', text: '#1D4ED8' },
  ELECTRICAL:  { bg: '#FEF9C3', text: '#854D0E' },
  PLUMBING:    { bg: '#DBEAFE', text: '#0369A1' },
  HVAC:        { bg: '#E0F2FE', text: '#0F766E' },
  ROOFING:     { bg: '#DCFCE7', text: '#166534' },
  FLOORING:    { bg: '#F3E8FF', text: '#7E22CE' },
  PAINTING:    { bg: '#FFF7ED', text: '#C2410C' },
  LANDSCAPING: { bg: '#F0FDF4', text: '#15803D' },
  DEMOLITION:  { bg: '#FEF2F2', text: '#B91C1C' },
  OTHER:       { bg: '#F8F7F5', text: '#6B6B67' },
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open', AWARDED: 'Awarded', IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN:        { bg: '#DCFCE7', text: '#166534' },
  AWARDED:     { bg: '#DBEAFE', text: '#1E40AF' },
  IN_PROGRESS: { bg: '#FEF9C3', text: '#854D0E' },
  COMPLETED:   { bg: '#F8F7F5', text: '#6B6B67' },
  CANCELLED:   { bg: '#FEE2E2', text: '#991B1B' },
};

const BID_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:   { bg: '#FEF9C3', text: '#854D0E' },
  ACCEPTED:  { bg: '#DCFCE7', text: '#166534' },
  REJECTED:  { bg: '#F8F7F5', text: '#6B6B67' },
  WITHDRAWN: { bg: '#F8F7F5', text: '#6B6B67' },
};

// ── Utilities ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const AVATAR_COLORS = [
  { bg: '#DBEAFE', text: '#1E40AF' }, { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#EDE9FE', text: '#5B21B6' }, { bg: '#FEE2E2', text: '#991B1B' },
  { bg: '#FEF3C7', text: '#92400E' }, { bg: '#E0F2FE', text: '#0369A1' },
];

function getAvatarColor(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function BidAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const color = getAvatarColor(name);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: color.bg, color: color.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 600, flexShrink: 0, userSelect: 'none',
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function PageSkeleton() {
  const block = (w: number | string, h: number, style?: React.CSSProperties) => (
    <div className={styles.skeleton} style={{ width: w, height: h, borderRadius: 4, ...style }} />
  );
  return (
    <div className={styles.wrap}>
      <div className={styles.content}>
        <div className={styles.section} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {block(100, 22, { borderRadius: 20 })}
          {block('70%', 32)}
          {block('40%', 16)}
          {block(160, 26)}
        </div>
        <div className={styles.section} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {block('30%', 16)}
          {[100, 85, 90, 60].map((w, i) => <div key={i}>{block(`${w}%`, 14)}</div>)}
        </div>
      </div>
      <div className={styles.sidebar}>
        <div className={styles.sidebarCard} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {block('50%', 18)}
          {block('100%', 48)}
          {block('100%', 100)}
          {block('100%', 40)}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar: Bid form (contractor, no bid yet) ─────────────────────────────────

function BidFormCard({ job, onSuccess }: { job: JobPost; onSuccess: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount]   = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors]   = useState<{ amount?: string; message?: string }>({});

  const mutation = useMutation({
    mutationFn: () => createBid(job.id, {
      amount: parseFloat(amount),
      message: message.trim(),
    }),
    onSuccess: () => {
      toast('Bid submitted successfully!');
      qc.invalidateQueries({ queryKey: ['jobs', job.id] });
      onSuccess();
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to submit bid', 'error');
    },
  });

  function validate() {
    const e: typeof errors = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid bid amount';
    const msg = message.trim();
    if (msg.length < 20)  e.message = `At least 20 characters required (${msg.length}/20)`;
    if (msg.length > 500) e.message = 'Maximum 500 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) mutation.mutate();
  }

  const msgLen = message.length;

  return (
    <div className={styles.sidebarCard}>
      <h3 className={styles.cardTitle}>Submit Your Bid</h3>
      <form onSubmit={handleSubmit}>
        {/* Amount */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Your Bid Amount</label>
          <div className={styles.moneyWrap}>
            <span className={styles.moneyPrefix}>$</span>
            <input
              type="number"
              className={styles.moneyInput}
              placeholder={`${job.budgetMin.toLocaleString()}–${job.budgetMax.toLocaleString()}`}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: undefined })); }}
              min={1}
            />
          </div>
          {errors.amount && <p className={styles.fieldError}>{errors.amount}</p>}
          <p className={styles.fieldHint}>
            Suggested range: ${job.budgetMin.toLocaleString()}–${job.budgetMax.toLocaleString()}
          </p>
        </div>

        {/* Message */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Cover Message</label>
          <textarea
            className={styles.textarea}
            rows={5}
            placeholder="Describe your approach, timeline, and why you are the right fit..."
            value={message}
            onChange={(e) => { setMessage(e.target.value); setErrors((p) => ({ ...p, message: undefined })); }}
            maxLength={500}
          />
          <div className={styles.textareaFooter}>
            {errors.message
              ? <p className={styles.fieldError}>{errors.message}</p>
              : <span />
            }
            <span className={`${styles.charCount} ${msgLen < 20 ? styles.charCountWarn : ''}`}>
              {msgLen}/500
            </span>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className={styles.fullWidthBtn}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Submitting…' : 'Submit Bid'}
        </Button>
      </form>
      <p className={styles.privacyNote}>Your bid is visible only to the investor.</p>
    </div>
  );
}

// ── Sidebar: My bid (contractor, already bid) ──────────────────────────────────

function MyBidCard({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  const { data: bid, isLoading } = useQuery({
    queryKey: ['jobs', jobId, 'my-bid'],
    queryFn:  () => getMyBid(jobId),
    staleTime: 30_000,
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawBid(jobId, bid!.id),
    onSuccess: () => {
      toast('Bid withdrawn.');
      qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      setConfirming(false);
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to withdraw bid', 'error');
    },
  });

  if (isLoading) {
    return (
      <div className={styles.sidebarCard}>
        <div className={styles.skeleton} style={{ width: '50%', height: 16, borderRadius: 4 }} />
      </div>
    );
  }

  if (!bid) return null;

  const statusColor = BID_STATUS_COLORS[bid.status] ?? BID_STATUS_COLORS.PENDING;

  return (
    <div className={styles.sidebarCard}>
      <div className={styles.cardTitleRow}>
        <h3 className={styles.cardTitle}>Your Bid</h3>
        <span
          className={styles.statusBadge}
          style={{ background: statusColor.bg, color: statusColor.text }}
        >
          {bid.status.charAt(0) + bid.status.slice(1).toLowerCase()}
        </span>
      </div>

      <div className={styles.bidSummary}>
        <p className={styles.bidAmount}>${bid.amount.toLocaleString()}</p>
        <p className={styles.bidMessageLabel}>Your message</p>
        <p className={styles.bidMessage}>{bid.message}</p>
        <p className={styles.bidMeta}>Submitted {timeAgo(bid.createdAt)}</p>
      </div>

      {bid.status === 'PENDING' && (
        confirming ? (
          <div className={styles.confirmBox}>
            <div className={styles.confirmRow}>
              <AlertTriangle size={14} color="var(--color-warning)" />
              <span className={styles.confirmText}>Are you sure you want to withdraw your bid?</span>
            </div>
            <div className={styles.confirmBtns}>
              <button className={styles.cancelBtn} onClick={() => setConfirming(false)}>
                Keep Bid
              </button>
              <button
                className={styles.confirmWithdrawBtn}
                onClick={() => withdraw.mutate()}
                disabled={withdraw.isPending}
              >
                {withdraw.isPending ? 'Withdrawing…' : 'Yes, Withdraw'}
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.withdrawBtn} onClick={() => setConfirming(true)}>
            Withdraw Bid
          </button>
        )
      )}
    </div>
  );
}

// ── Sidebar: Investor view (owns the job) ─────────────────────────────────────

function InvestorCard({
  job, bidsRef,
}: {
  job: JobPost;
  bidsRef: React.RefObject<HTMLElement | null>;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancel = useMutation({
    mutationFn: () => cancelJob(job.id),
    onSuccess: () => {
      toast('Job cancelled.');
      qc.invalidateQueries({ queryKey: ['jobs', job.id] });
      setConfirmCancel(false);
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to cancel job', 'error');
    },
  });

  function scrollToBids() {
    bidsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className={styles.sidebarCard}>
      <h3 className={styles.cardTitle}>Your Job</h3>

      <div className={styles.investorStat}>
        <span className={styles.investorStatNum}>{job.bidCount}</span>
        <span className={styles.investorStatLabel}>
          bid{job.bidCount !== 1 ? 's' : ''} received
        </span>
      </div>

      {job.bidCount > 0 && (
        <button className={styles.viewBidsBtn} onClick={scrollToBids}>
          View all bids ↓
        </button>
      )}

      {job.status === 'OPEN' && (
        <Link to={`/jobs/${job.id}/edit`} className={styles.editLink}>
          Edit job details
        </Link>
      )}

      {job.status === 'OPEN' && (
        confirmCancel ? (
          <div className={styles.confirmBox}>
            <div className={styles.confirmRow}>
              <AlertTriangle size={14} color="var(--color-warning)" />
              <span className={styles.confirmText}>Cancel this job? This cannot be undone.</span>
            </div>
            <div className={styles.confirmBtns}>
              <button className={styles.cancelBtn} onClick={() => setConfirmCancel(false)}>
                Keep Job
              </button>
              <button
                className={styles.confirmWithdrawBtn}
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
              >
                {cancel.isPending ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.dangerTextBtn} onClick={() => setConfirmCancel(true)}>
            Cancel Job
          </button>
        )
      )}
    </div>
  );
}

// ── Sidebar: Guest / non-owner CTA ────────────────────────────────────────────

function GuestCard() {
  return (
    <div className={styles.sidebarCard}>
      <h3 className={styles.cardTitle}>Want to work on this project?</h3>
      <p className={styles.guestText}>
        Create a contractor account to submit bids and connect with investors.
      </p>
      <Link to="/register">
        <Button variant="primary" className={styles.fullWidthBtn}>
          Sign up as a contractor
        </Button>
      </Link>
      <p className={styles.guestSignIn}>
        Already have an account?{' '}
        <Link to="/login" className={styles.inlineLink}>Sign in</Link>
      </p>
    </div>
  );
}

// ── Messages section ───────────────────────────────────────────────────────────

function MessagesSection({
  jobId,
  userId,
  userRole,
}: {
  jobId:    string;
  userId:   string;
  userRole: string;
}) {
  const { toast } = useToast();
  const qc        = useQueryClient();
  const listRef   = useRef<HTMLDivElement>(null);

  const [draft,       setDraft]       = useState('');
  const [polished,    setPolished]    = useState<string | null>(null);
  const [showPolish,  setShowPolish]  = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);

  const [summaryOpen,   setSummaryOpen]   = useState(false);
  const [summary,       setSummary]       = useState<{ text: string; count: number } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['jobs', jobId, 'messages'],
    queryFn:  () => getJobMessages(jobId),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendJobMessage(jobId, body),
    onSuccess: () => {
      setDraft('');
      setPolished(null);
      setShowPolish(false);
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'messages'] });
    },
    onError: (err: Error) => toast(err.message || 'Failed to send message', 'error'),
  });

  async function handlePolish() {
    const text = draft.trim();
    if (!text) return;
    setIsPolishing(true);
    try {
      const result = await polishReply(text, userRole === 'INVESTOR' ? 'investor' : 'contractor');
      setPolished(result.polished);
      setShowPolish(true);
    } catch {
      toast('AI polish unavailable', 'error');
    } finally {
      setIsPolishing(false);
    }
  }

  async function handleSummarize() {
    setIsSummarizing(true);
    try {
      const result = await summarizeThread(jobId);
      setSummary({ text: result.summary, count: result.messageCount });
      setSummaryOpen(true);
    } catch {
      toast('Summarization unavailable', 'error');
    } finally {
      setIsSummarizing(false);
    }
  }

  function handleSend() {
    const text = (showPolish && polished ? polished : draft).trim();
    if (!text || sendMutation.isPending) return;
    sendMutation.mutate(text);
  }

  const context: 'investor' | 'contractor' = userRole === 'INVESTOR' ? 'investor' : 'contractor';
  void context; // used above in handlePolish

  return (
    <section className={styles.section}>

      {/* Header row */}
      <div className={styles.msgSectionHeader}>
        <h2 className={styles.sectionTitle} style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
          Messages
        </h2>
        {messages.length >= 5 && (
          <button
            type="button"
            className={styles.summarizeBtn}
            onClick={handleSummarize}
            disabled={isSummarizing}
          >
            {isSummarizing ? '…' : '✦ Summarize thread'}
          </button>
        )}
      </div>

      {/* Summary card */}
      {summaryOpen && summary && (
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <span className={styles.summaryTitle}>✦ Thread Summary</span>
            <span className={styles.summaryMeta}>Based on {summary.count} messages</span>
            <button type="button" className={styles.summaryClose} onClick={() => setSummaryOpen(false)}>
              ×
            </button>
          </div>
          <div className={styles.summaryBody}>
            {summary.text.split('\n').filter(Boolean).map((line, i) => (
              <p key={i} className={styles.summaryLine}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Message list */}
      <div className={styles.msgList} ref={listRef}>
        {isLoading ? (
          <div className={styles.skeleton} style={{ height: 48, borderRadius: 8, margin: '8px 0' }} />
        ) : messages.length === 0 ? (
          <p className={styles.msgEmpty}>No messages yet. Start the conversation below.</p>
        ) : (
          messages.map((msg: Message) => {
            const isOwn = msg.senderId === userId;
            const name  = `${msg.sender.firstName} ${msg.sender.lastName}`;
            return (
              <div key={msg.id} className={`${styles.msgRow} ${isOwn ? styles.msgRowOwn : styles.msgRowOther}`}>
                {!isOwn && (
                  <div className={styles.msgAvatar}>{getInitials(name)}</div>
                )}
                <div className={styles.msgBubbleWrap}>
                  {!isOwn && <span className={styles.msgSenderName}>{name}</span>}
                  <div className={`${styles.msgBubble} ${isOwn ? styles.msgBubbleOwn : styles.msgBubbleOther}`}>
                    {msg.isAiGenerated && (
                      <span className={styles.msgAiBadge}>✦ AI</span>
                    )}
                    <p className={styles.msgText}>{msg.body}</p>
                  </div>
                  <span className={`${styles.msgTime} ${isOwn ? styles.msgTimeOwn : ''}`}>
                    {timeAgo(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Polish diff card */}
      {showPolish && polished && (
        <div className={styles.polishCard}>
          <div className={styles.polishCardHeader}>
            <span className={styles.polishCardTitle}>✦ AI Polish Suggestion</span>
            <button
              type="button"
              className={styles.polishCardClose}
              onClick={() => { setShowPolish(false); setPolished(null); }}
            >
              ×
            </button>
          </div>
          <div className={styles.polishCardBody}>
            <div className={styles.polishCol}>
              <span className={styles.polishColLabel}>Original</span>
              <p className={styles.polishColText}>{draft}</p>
            </div>
            <div className={styles.polishDivider} />
            <div className={styles.polishCol}>
              <span className={styles.polishColLabel}>Polished</span>
              <p className={styles.polishColText}>{polished}</p>
            </div>
          </div>
          <div className={styles.polishCardActions}>
            <button
              type="button"
              className={styles.polishUseBtn}
              onClick={() => { setDraft(polished); setShowPolish(false); setPolished(null); }}
            >
              Use polished version
            </button>
            <button
              type="button"
              className={styles.polishKeepBtn}
              onClick={() => { setShowPolish(false); setPolished(null); }}
            >
              Keep original
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className={styles.msgInputWrap}>
        <textarea
          className={styles.msgTextarea}
          rows={3}
          placeholder="Type a message… (Cmd+Enter to send)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
          }}
        />
        <div className={styles.msgInputActions}>
          <button
            type="button"
            className={styles.polishReplyBtn}
            onClick={handlePolish}
            disabled={!draft.trim() || isPolishing}
          >
            {isPolishing ? '…' : '✦ Polish Reply'}
          </button>
          <button
            type="button"
            className={styles.msgSendBtn}
            onClick={handleSend}
            disabled={(!draft.trim() && !(showPolish && polished)) || sendMutation.isPending}
          >
            {sendMutation.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>

    </section>
  );
}

// ── Bids list (investor only) ──────────────────────────────────────────────────

function BidsList({ jobId }: { jobId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: bids, isLoading } = useQuery({
    queryKey: ['jobs', jobId, 'bids'],
    queryFn:  () => getJobBids(jobId),
    staleTime: 30_000,
  });

  const accept = useMutation({
    mutationFn: (bidId: string) => acceptBid(jobId, bidId),
    onSuccess: () => {
      toast('Bid accepted! Job has been awarded.');
      qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'bids'] });
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to accept bid', 'error');
    },
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2].map((i) => (
          <div key={i} className={styles.skeleton} style={{ height: 80, borderRadius: 8 }} />
        ))}
      </div>
    );
  }

  if (!bids || bids.length === 0) {
    return (
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', textAlign: 'center', padding: '24px 0' }}>
        No bids yet.
      </p>
    );
  }

  return (
    <div className={styles.bidsList}>
      {bids.map((bid: BidWithContractor) => {
        const name = bid.contractor
          ? `${bid.contractor.user.firstName} ${bid.contractor.user.lastName}`
          : 'Unknown Contractor';
        const rating       = bid.contractor?.averageRating ?? 0;
        const totalReviews = bid.contractor?.totalReviews  ?? 0;
        const hasRating    = rating > 0;
        const statusColor  = BID_STATUS_COLORS[bid.status] ?? BID_STATUS_COLORS.PENDING;

        return (
          <div key={bid.id} className={styles.bidRow}>
            <div className={styles.bidRowHeader}>
              <BidAvatar name={name} size={40} />
              <div className={styles.bidContractorInfo}>
                <p className={styles.bidContractorName}>{name}</p>
                {hasRating ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <StarRating rating={rating} size={11} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      ({totalReviews})
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No reviews yet</span>
                )}
              </div>
              <div className={styles.bidRowRight}>
                <p className={styles.bidRowAmount}>${bid.amount.toLocaleString()}</p>
                <span
                  className={styles.statusBadge}
                  style={{ background: statusColor.bg, color: statusColor.text }}
                >
                  {bid.status === 'REJECTED' ? 'Not selected' : bid.status.charAt(0) + bid.status.slice(1).toLowerCase()}
                </span>
              </div>
            </div>
            <p className={styles.bidRowMessage}>{bid.message}</p>
            {bid.status === 'PENDING' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  className={styles.acceptBtn}
                  onClick={() => accept.mutate(bid.id)}
                  disabled={accept.isPending}
                >
                  {accept.isPending ? 'Accepting…' : 'Accept Bid'}
                </button>
              </div>
            )}
            {bid.status === 'ACCEPTED' && (
              <div className={styles.acceptedBanner}>
                <CheckCircle2 size={13} strokeWidth={2.5} />
                Accepted
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function JobDetailPage() {
  const { id }        = useParams<{ id: string }>();
  const { user }      = useAuth();
  const bidsRef       = useRef<HTMLElement | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['jobs', id],
    queryFn:  () => getJobById(id!),
    enabled:  !!id,
    staleTime: 30_000,
  });

  const isContractor   = user?.role === 'CONTRACTOR';
  const isInvestor     = user?.role === 'INVESTOR';
  const isOwner        = isInvestor && job?.investorId === user?.id;

  // Fetch bids when investor owns job (for accepted contractor name in review modal)
  const { data: bids } = useQuery({
    queryKey: ['jobs', id, 'bids'],
    queryFn:  () => getJobBids(id!),
    enabled:  !!id && isOwner,
    staleTime: 30_000,
  });

  const acceptedBid    = bids?.find((b) => b.status === 'ACCEPTED');
  const contractorName = acceptedBid?.contractor
    ? `${acceptedBid.contractor.user.firstName} ${acceptedBid.contractor.user.lastName}`
    : 'the contractor';
  const investorName   = job ? `${job.investor.firstName} ${job.investor.lastName}` : '';

  // Sidebar state machine
  let sidebarVariant: 'bid-form' | 'my-bid' | 'investor' | 'guest';
  if (isContractor) {
    sidebarVariant = job?.hasBid ? 'my-bid' : 'bid-form';
  } else if (isOwner) {
    sidebarVariant = 'investor';
  } else {
    sidebarVariant = 'guest';
  }

  const tradeColor  = TRADE_COLORS[job?.tradeType ?? ''] ?? TRADE_COLORS.OTHER;
  const tradeLabel  = TRADE_LABELS[job?.tradeType ?? ''] ?? job?.tradeType ?? '';
  const statusColor = STATUS_COLORS[job?.status ?? ''] ?? STATUS_COLORS.OPEN;
  const location    = job ? [job.city, job.state].filter(Boolean).join(', ') : '';

  if (isError) {
    return (
      <div className={styles.page}>
        <nav className={styles.nav}>
          <Link to="/" className={styles.navWordmark}>BuildMatch</Link>
          <Link to="/jobs" className={styles.navBack}>
            <ArrowLeft size={14} strokeWidth={2} /> All jobs
          </Link>
        </nav>
        <div className={styles.errorState}>
          <p className={styles.errorTitle}>Job not found</p>
          <p className={styles.errorSub}>This job may have been removed or the link is incorrect.</p>
          <Link to="/jobs"><Button variant="secondary" size="sm">← Back to jobs</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.navWordmark}>BuildMatch</Link>
        <Link to="/jobs" className={styles.navBack}>
          <ArrowLeft size={14} strokeWidth={2} /> All jobs
        </Link>
      </nav>

      {isLoading && <PageSkeleton />}

      {job && (
        <div className={styles.wrap}>

          {/* ── Left content ───────────────────────────────── */}
          <div className={styles.content}>

            {/* Job header */}
            <section className={styles.section}>
              <div className={styles.headerTopRow}>
                <span
                  className={styles.tradeBadge}
                  style={{ background: tradeColor.bg, color: tradeColor.text }}
                >
                  {tradeLabel}
                </span>
                <span
                  className={styles.statusBadge}
                  style={{ background: statusColor.bg, color: statusColor.text }}
                >
                  {STATUS_LABELS[job.status] ?? job.status}
                </span>
              </div>
              <h1 className={styles.jobTitle}>{job.title}</h1>
              <p className={styles.jobMeta}>
                <Calendar size={13} strokeWidth={1.75} />
                Posted {timeAgo(job.createdAt)}
                {location && (
                  <>
                    <span className={styles.metaDot}>·</span>
                    <MapPin size={13} strokeWidth={1.75} />
                    {location}
                  </>
                )}
              </p>
              <p className={styles.budget}>
                <DollarSign size={16} strokeWidth={2} />
                ${job.budgetMin.toLocaleString()}–${job.budgetMax.toLocaleString()}
              </p>
            </section>

            {/* Description */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Project Description</h2>
              <p className={styles.description}>{job.description}</p>
            </section>

            {/* Details grid */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Project Details</h2>
              <div className={styles.detailsGrid}>
                <div className={styles.detailCell}>
                  <span className={styles.detailLabel}>
                    <Briefcase size={12} strokeWidth={2} /> Trade Type
                  </span>
                  <span className={styles.detailValue}>{tradeLabel}</span>
                </div>
                <div className={styles.detailCell}>
                  <span className={styles.detailLabel}>
                    <MapPin size={12} strokeWidth={2} /> Location
                  </span>
                  <span className={styles.detailValue}>{location || '—'}{job.zipCode ? ` ${job.zipCode}` : ''}</span>
                </div>
                <div className={styles.detailCell}>
                  <span className={styles.detailLabel}>
                    <DollarSign size={12} strokeWidth={2} /> Budget
                  </span>
                  <span className={styles.detailValue}>
                    ${job.budgetMin.toLocaleString()}–${job.budgetMax.toLocaleString()}
                  </span>
                </div>
                <div className={styles.detailCell}>
                  <span className={styles.detailLabel}>Status</span>
                  <span
                    className={styles.statusBadge}
                    style={{ background: statusColor.bg, color: statusColor.text, fontSize: 12 }}
                  >
                    {STATUS_LABELS[job.status] ?? job.status}
                  </span>
                </div>
                <div className={styles.detailCell}>
                  <span className={styles.detailLabel}>
                    <Calendar size={12} strokeWidth={2} /> Posted
                  </span>
                  <span className={styles.detailValue}>{formatDate(job.createdAt)}</span>
                </div>
                <div className={styles.detailCell}>
                  <span className={styles.detailLabel}>
                    <Users size={12} strokeWidth={2} /> Bids
                  </span>
                  <span className={styles.detailValue}>
                    {job.bidCount} bid{job.bidCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </section>

            {/* Complete job callout (investor, IN_PROGRESS, not yet completed) */}
            {isOwner && job.status === 'IN_PROGRESS' && !job.isCompleted && (
              <section className={styles.section}>
                <div className={styles.completeCallout}>
                  <div className={styles.completeCalloutIcon}>
                    <CheckCircle2 size={20} color="#16A34A" strokeWidth={2} />
                  </div>
                  <div className={styles.completeCalloutBody}>
                    <p className={styles.completeCalloutTitle}>All milestones complete — ready to close this job</p>
                    <p className={styles.completeCalloutDesc}>
                      Mark the job as complete to release final payments and leave a review for the contractor.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setReviewModalOpen(true)}
                  >
                    Mark as Complete &amp; Leave a Review
                  </Button>
                </div>
              </section>
            )}

            {/* Contractor review banner (job complete, reviews unlocked) */}
            {isContractor && job.reviewsUnlocked && (
              <section className={styles.section}>
                <div className={styles.reviewBanner}>
                  <Star size={16} strokeWidth={1.75} color="#F59E0B" fill="#F59E0B" />
                  <div className={styles.reviewBannerBody}>
                    <p className={styles.reviewBannerTitle}>
                      Leave a review for {investorName} to complete the job
                    </p>
                    <p className={styles.reviewBannerDesc}>
                      Share your experience working with this client.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setReviewModalOpen(true)}
                  >
                    Leave a Review
                  </Button>
                </div>
              </section>
            )}

            {/* Bids (investor/owner only) */}
            {isOwner && (
              <section
                className={styles.section}
                ref={(el) => { bidsRef.current = el; }}
              >
                <h2 className={styles.sectionTitle}>Bids</h2>
                <BidsList jobId={job.id} />
              </section>
            )}

            {/* Messages (investor who owns job, or contractor with a bid) */}
            {user && (isOwner || (isContractor && job.hasBid)) && (
              <MessagesSection
                jobId={job.id}
                userId={user.id}
                userRole={user.role}
              />
            )}

          </div>

          {/* ── Right sidebar ──────────────────────────────── */}
          <aside className={styles.sidebar}>
            {sidebarVariant === 'bid-form' && job.status === 'OPEN' && (
              <BidFormCard
                job={job}
                onSuccess={() => {}}
              />
            )}
            {sidebarVariant === 'bid-form' && job.status !== 'OPEN' && (
              <div className={styles.sidebarCard}>
                <p style={{ fontSize: 14, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                  This job is no longer accepting bids.
                </p>
              </div>
            )}
            {sidebarVariant === 'my-bid' && <MyBidCard jobId={job.id} />}
            {sidebarVariant === 'investor' && (
              <InvestorCard job={job} bidsRef={bidsRef} />
            )}
            {sidebarVariant === 'guest' && <GuestCard />}
          </aside>

        </div>
      )}

      {/* Review modal */}
      {job && (
        <ReviewModal
          open={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          jobId={job.id}
          revieweeName={isOwner ? contractorName : investorName}
          reviewerRole={isOwner ? 'INVESTOR' : 'CONTRACTOR'}
          alreadyCompleted={!!job.isCompleted}
          onSuccess={() => setReviewModalOpen(false)}
        />
      )}
    </div>
  );
}
