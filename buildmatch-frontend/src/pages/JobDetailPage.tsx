import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Calendar, DollarSign, Briefcase,
  Users, AlertTriangle, CheckCircle2, Star, Camera, MessageSquare, FileText,
  Lock, Clock,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import {
  getJobById, getJobBids, getMyBid,
  createBid, acceptBid, withdrawBid, cancelJob,
  getJobMessages, sendJobMessage,
} from '../services/job.service';
import { generateContract, getContractByJob } from '../services/contract.service';
import { polishReply, summarizeThread } from '../services/ai.service';
import api from '../services/api';
import { ReviewModal } from '../components/review/ReviewModal';
import { getOrCreateConversation } from '../services/message.service';
import { StarRating } from '../components/ui/StarRating';
import { Button } from '../components/ui/Button';
import { Lightbox } from '../components/ui/Lightbox';
import type { BidWithContractor, JobPost, Message } from '../types/job.types';
import styles from './JobDetailPage.module.css';
import { getOptimizedUrl, JOB_PHOTO_FALLBACK } from '../utils/media';
import { RecommendedContractors } from '../components/job/RecommendedContractors';
import { BidAnalysisPanel, BidAnalysisPanelErrorBoundary } from '../components/job/BidAnalysisPanel';
import { ActiveDrawTracker } from '../components/job/ActiveDrawTracker';

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

// ── Types ──────────────────────────────────────────────────────────────────────

interface DrawScheduleSummary {
  id:     string;
  status: 'DRAFT' | 'NEGOTIATING' | 'PENDING_APPROVAL' | 'LOCKED';
}

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

// ── Photo gallery ──────────────────────────────────────────────────────────────

// ── GalleryImg — isolates per-image error state ────────────────────────────────

function GalleryImg({
  url, alt, className, width, onClick,
}: {
  url: string; alt: string; className: string; width: number; onClick: () => void;
}) {
  const [error, setError] = useState(false);
  return (
    <img
      src={error ? JOB_PHOTO_FALLBACK : getOptimizedUrl(url, width)}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setError(true)}
      onClick={onClick}
    />
  );
}

function PhotoGallery({ photos }: { photos: string[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const MAX_VISIBLE = 5;

  const handleClick = useCallback((idx: number) => setLightboxIdx(idx), []);
  const handleClose = useCallback(() => setLightboxIdx(null), []);

  const galleryContent = () => {
    if (photos.length === 1) {
      return (
        <div className={styles.gallery1}>
          <GalleryImg
            url={photos[0]}
            alt="Project photo 1"
            className={styles.galleryImg}
            width={1200}
            onClick={() => handleClick(0)}
          />
        </div>
      );
    }

    if (photos.length <= 3) {
      return (
        <div className={styles.gallery2col}>
          {photos.map((url, i) => (
            <GalleryImg
              key={url}
              url={url}
              alt={`Project photo ${i + 1}`}
              className={styles.galleryImg}
              width={600}
              onClick={() => handleClick(i)}
            />
          ))}
        </div>
      );
    }

    // 4+ photos: mosaic
    const visible = photos.slice(0, MAX_VISIBLE);
    const overflow = photos.length - MAX_VISIBLE;
    return (
      <div className={styles.mosaic}>
        <GalleryImg
          url={photos[0]}
          alt="Project photo 1"
          className={`${styles.galleryImg} ${styles.mosaicMain}`}
          width={1200}
          onClick={() => handleClick(0)}
        />
        <div className={styles.mosaicGrid}>
          {visible.slice(1).map((url, i) => {
            const realIdx = i + 1;
            const isLast = i === visible.length - 2 && overflow > 0;
            return (
              <div key={url} style={{ position: 'relative' }}>
                <GalleryImg
                  url={url}
                  alt={`Project photo ${realIdx + 1}`}
                  className={`${styles.galleryImg} ${styles.mosaicThumb}`}
                  width={400}
                  onClick={() => handleClick(realIdx)}
                />
                {isLast && overflow > 0 && (
                  <div className={styles.moreOverlay} onClick={() => handleClick(realIdx)}>
                    <Camera size={16} strokeWidth={2} />
                    <span>+{overflow} more</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Project Photos</h2>
      {galleryContent()}
      {lightboxIdx !== null && (
        <Lightbox images={photos} initialIndex={lightboxIdx} onClose={handleClose} />
      )}
    </section>
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

      {/* Budget context strip */}
      <div className={styles.budgetCtx}>
        <span className={styles.budgetCtxLabel}>Investor's budget</span>
        <span className={styles.budgetCtxValue}>
          ${job.budgetMin.toLocaleString()} – ${job.budgetMax.toLocaleString()}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Amount */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Your Bid Amount</label>
          <div className={styles.moneyWrap}>
            <span className={styles.moneyPrefix}>$</span>
            <input
              type="number"
              className={styles.moneyInput}
              placeholder={job.budgetMin.toLocaleString()}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: undefined })); }}
              min={1}
            />
          </div>
          {errors.amount && <p className={styles.fieldError}>{errors.amount}</p>}
        </div>

        {/* Cover message */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Cover Message</label>
          <textarea
            className={styles.textarea}
            rows={5}
            placeholder="Describe your approach, relevant experience, and why you're the right fit…"
            value={message}
            onChange={(e) => { setMessage(e.target.value); setErrors((p) => ({ ...p, message: undefined })); }}
            maxLength={500}
          />
          <div className={styles.textareaFooter}>
            {errors.message ? (
              <p className={styles.fieldError}>{errors.message}</p>
            ) : msgLen < 20 ? (
              <span className={styles.charMin}>{20 - msgLen} more chars needed</span>
            ) : (
              <span />
            )}
            <span className={`${styles.charCount} ${msgLen > 450 ? styles.charCountWarn : ''}`}>
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

function MyBidCard({ jobId, investorId, jobStatus }: { jobId: string; investorId: string; jobStatus?: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [messaging, setMessaging] = useState(false);

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
  const isAccepted  = bid.status === 'ACCEPTED';

  return (
    <div className={`${styles.sidebarCard} ${isAccepted ? styles.sidebarCardAccepted : ''}`}>
      {/* Accepted banner */}
      {isAccepted && (
        <div className={styles.myBidAcceptedBanner}>
          <CheckCircle2 size={14} strokeWidth={2.5} color="#166534" />
          <span>Your bid was accepted — you got the job!</span>
        </div>
      )}

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

      {bid.status === 'ACCEPTED' && (
        <button
          className={styles.viewBidsBtn}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}
          disabled={messaging}
          onClick={async () => {
            setMessaging(true);
            try {
              const conv = await getOrCreateConversation(jobId, investorId);
              navigate(`/dashboard/messages/${conv.id}`);
            } catch {
              toast('Could not open conversation. Please try again.', 'error');
            } finally {
              setMessaging(false);
            }
          }}
        >
          <MessageSquare size={14} strokeWidth={2} />
          {messaging ? 'Opening…' : 'Message Investor'}
        </button>
      )}

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

      {isAccepted && jobStatus === 'IN_PROGRESS' && (
        <div className={styles.issueSection}>
          <p className={styles.issueText}>Having an issue with this job?</p>
          <Link to={`/settings/disputes/new?jobId=${jobId}`} className={styles.disputeLink}>
            File a Dispute
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Sidebar: Investor view (owns the job) ─────────────────────────────────────

function InvestorCard({
  job, bidsRef, acceptedBidId, contractId, contractIsActive,
}: {
  job:              JobPost;
  bidsRef:          React.RefObject<HTMLElement | null>;
  acceptedBidId:    string | undefined;
  contractId:       string | null | undefined;
  contractIsActive: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const showScheduleCard = ['AWARDED', 'IN_PROGRESS'].includes(job.status);

  const { data: schedule } = useQuery<DrawScheduleSummary | null>({
    queryKey: ['draw-schedule', job.id],
    queryFn:  () =>
      api.get<{ data: { schedule: DrawScheduleSummary | null } }>(`/jobs/${job.id}/draws`)
        .then((r) => r.data.data.schedule),
    enabled:   showScheduleCard,
    staleTime: 30_000,
  });

  const scheduleIsLocked = schedule?.status === 'LOCKED';

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

  const genContract = useMutation({
    mutationFn: () => generateContract(job.id, acceptedBidId!),
    onSuccess: (contract) => {
      toast('Contract generated!');
      qc.invalidateQueries({ queryKey: ['contract-by-job', job.id] });
      navigate(`/contracts/${contract.id}`);
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to generate contract', 'error');
    },
  });

  function scrollToBids() {
    bidsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── 4-step progression stepper (AWARDED) ────────────────────────────────────
  const step1Done   = scheduleIsLocked;
  const step2Done   = contractIsActive;
  const step2Active = step1Done && !step2Done;
  const step3Active = step2Done;

  function StepCircle({ n, done, active }: { n: number; done: boolean; active: boolean }) {
    const bg    = done ? 'var(--color-accent)' : active ? 'var(--color-primary)' : 'var(--color-border)';
    const color = done || active ? '#fff' : 'var(--color-text-muted)';
    return (
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 'var(--font-weight-semibold)', color,
        flexShrink: 0,
      }}>
        {done ? <CheckCircle2 size={13} strokeWidth={2.5} /> : n}
      </div>
    );
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

      {/* 4-step progression stepper — AWARDED */}
      {job.status === 'AWARDED' && (
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            Next Steps
          </p>

          {/* Step 1: Set up draw schedule */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderLeft: step1Done ? '2px solid var(--color-accent)' : '2px solid var(--color-border)', marginLeft: 11, paddingLeft: 'var(--space-3)' }}>
            <StepCircle n={1} done={step1Done} active={!step1Done} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 'var(--font-weight-medium)', color: step1Done ? 'var(--color-text-muted)' : 'var(--color-text-primary)', margin: 0 }}>
                Set up payment schedule
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                {step1Done ? 'Locked by both parties' : 'Both parties must approve'}
              </p>
              {!step1Done && (
                <Link
                  to={`/jobs/${job.id}/draw-schedule`}
                  style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', display: 'inline-block', marginTop: 4 }}
                >
                  {schedule ? 'Review schedule →' : 'Set up schedule →'}
                </Link>
              )}
              {step1Done && (
                <Link
                  to={`/jobs/${job.id}/draw-schedule`}
                  style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'inline-block', marginTop: 4 }}
                >
                  View →
                </Link>
              )}
            </div>
          </div>

          {/* Step 2: Review & sign contract */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderLeft: step2Done ? '2px solid var(--color-accent)' : '2px solid var(--color-border)', marginLeft: 11, paddingLeft: 'var(--space-3)' }}>
            <StepCircle n={2} done={step2Done} active={step2Active} />
            <div style={{ flex: 1, minWidth: 0, opacity: !step1Done ? 0.45 : 1 }}>
              <p style={{ fontSize: 13, fontWeight: 'var(--font-weight-medium)', color: step2Done ? 'var(--color-text-muted)' : 'var(--color-text-primary)', margin: 0 }}>
                Review &amp; sign contract
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                {step2Done ? 'Contract active' : step2Active ? 'Ready to generate' : 'Locked until step 1'}
              </p>
              {step2Active && acceptedBidId && !contractId && (
                <button
                  style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', background: 'none', border: 'none', padding: 0, cursor: genContract.isPending ? 'wait' : 'pointer', marginTop: 4, display: 'inline-block' }}
                  onClick={() => genContract.mutate()}
                  disabled={genContract.isPending}
                  type="button"
                >
                  {genContract.isPending ? 'Generating…' : 'Generate contract →'}
                </button>
              )}
              {contractId && (
                <Link
                  to={`/contracts/${contractId}`}
                  style={{ fontSize: 12, color: step2Done ? 'var(--color-text-muted)' : 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', display: 'inline-block', marginTop: 4 }}
                >
                  {step2Done ? 'View →' : 'Review & sign →'}
                </Link>
              )}
            </div>
          </div>

          {/* Step 3: Fund escrow */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderLeft: '2px solid var(--color-border)', marginLeft: 11, paddingLeft: 'var(--space-3)' }}>
            <StepCircle n={3} done={false} active={step3Active} />
            <div style={{ flex: 1, minWidth: 0, opacity: !step2Done ? 0.45 : 1 }}>
              <p style={{ fontSize: 13, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
                Fund escrow
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                {step3Active ? 'Funds held securely' : 'Locked until step 2'}
              </p>
              {step3Active && (
                <Link
                  to={`/dashboard/jobs/${job.id}/fund`}
                  style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', display: 'inline-block', marginTop: 4 }}
                >
                  Fund escrow →
                </Link>
              )}
            </div>
          </div>

          {/* Step 4: Project begins */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginLeft: 11, paddingLeft: 'var(--space-3)' }}>
            <StepCircle n={4} done={false} active={false} />
            <div style={{ flex: 1, minWidth: 0, opacity: 0.45 }}>
              <p style={{ fontSize: 13, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
                Project begins
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                Locked until escrow funded
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View contract link for IN_PROGRESS — contract exists */}
      {job.status !== 'AWARDED' && contractId && (
        <Link to={`/contracts/${contractId}`} className={styles.viewContractLink}>
          <FileText size={13} strokeWidth={2} />
          View Contract
        </Link>
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

      {job.status === 'IN_PROGRESS' && (
        <div className={styles.issueSection}>
          <p className={styles.issueText}>Having an issue with this job?</p>
          <Link to={`/settings/disputes/new?jobId=${job.id}`} className={styles.disputeLink}>
            File a Dispute
          </Link>
        </div>
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
  const navigate = useNavigate();
  const [messagingBidId, setMessagingBidId] = useState<string | null>(null);

  const { data: bids, isLoading } = useQuery({
    queryKey: ['jobs', jobId, 'bids'],
    queryFn:  () => getJobBids(jobId),
    staleTime: 30_000,
  });

  const accept = useMutation({
    mutationFn: (bidId: string) => acceptBid(jobId, bidId),
    onSuccess: () => {
      toast("Bid accepted! Let's set up the payment schedule.");
      qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      qc.invalidateQueries({ queryKey: ['jobs', jobId, 'bids'] });
      navigate(`/jobs/${jobId}/draw-schedule`);
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

        const isRowAccepted = bid.status === 'ACCEPTED';

        return (
          <div key={bid.id} className={`${styles.bidRow} ${isRowAccepted ? styles.bidRowAccepted : ''}`}>
            {/* Accepted chip at top */}
            {isRowAccepted && (
              <div className={styles.bidRowAcceptedBanner}>
                <CheckCircle2 size={12} strokeWidth={2.5} />
                Selected contractor
              </div>
            )}

            <div className={styles.bidRowHeader}>
              <BidAvatar name={name} size={40} />
              <div className={styles.bidContractorInfo}>
                {bid.contractor?.userId ? (
                  <Link
                    to={`/contractors/${bid.contractor.userId}`}
                    className={styles.bidContractorLink}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {name}
                  </Link>
                ) : (
                  <p className={styles.bidContractorName}>{name}</p>
                )}
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
              <div className={styles.bidRowActions}>
                <button
                  className={styles.viewBidsBtn}
                  style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  disabled={messagingBidId === bid.id}
                  onClick={async () => {
                    if (!bid.contractor?.userId) return;
                    setMessagingBidId(bid.id);
                    try {
                      const conv = await getOrCreateConversation(jobId, bid.contractor.userId);
                      navigate(`/dashboard/messages/${conv.id}`);
                    } catch {
                      toast('Could not open conversation. Please try again.', 'error');
                    } finally {
                      setMessagingBidId(null);
                    }
                  }}
                >
                  <MessageSquare size={13} strokeWidth={2} />
                  {messagingBidId === bid.id ? 'Opening…' : 'Message'}
                </button>
                <button
                  className={styles.acceptBtn}
                  onClick={() => accept.mutate(bid.id)}
                  disabled={accept.isPending}
                >
                  {accept.isPending ? 'Accepting…' : 'Accept Bid'}
                </button>
              </div>
            )}

            {isRowAccepted && (
              <div className={styles.bidRowActions}>
                <button
                  className={styles.viewBidsBtn}
                  style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  disabled={messagingBidId === bid.id}
                  onClick={async () => {
                    if (!bid.contractor?.userId) return;
                    setMessagingBidId(bid.id);
                    try {
                      const conv = await getOrCreateConversation(jobId, bid.contractor.userId);
                      navigate(`/dashboard/messages/${conv.id}`);
                    } catch {
                      toast('Could not open conversation. Please try again.', 'error');
                    } finally {
                      setMessagingBidId(null);
                    }
                  }}
                >
                  <MessageSquare size={13} strokeWidth={2} />
                  {messagingBidId === bid.id ? 'Opening…' : 'Message'}
                </button>
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

  // Fetch contract for AWARDED/IN_PROGRESS jobs where user is a party
  const isParty = isOwner || (isContractor && job?.hasBid);
  const fetchContract = !!id && !!user && !!job &&
    ['AWARDED', 'IN_PROGRESS', 'COMPLETED'].includes(job.status) && isParty;

  const { data: existingContract } = useQuery({
    queryKey: ['contract-by-job', id],
    queryFn:  () => getContractByJob(id!),
    enabled:  fetchContract,
    staleTime: 60_000,
  });

  const acceptedBid    = bids?.find((b) => b.status === 'ACCEPTED');
  const contractorName = acceptedBid?.contractor
    ? `${acceptedBid.contractor.user.firstName} ${acceptedBid.contractor.user.lastName}`
    : 'the contractor';
  const contractId = existingContract?.id ?? null;
  const contractPendingSig = existingContract?.status === 'PENDING_SIGNATURES';
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
          <Link to="/dashboard/browse-jobs" className={styles.navBack}>
            <ArrowLeft size={14} strokeWidth={2} /> All jobs
          </Link>
        </nav>
        <div className={styles.errorState}>
          <p className={styles.errorTitle}>Job not found</p>
          <p className={styles.errorSub}>This job may have been removed or the link is incorrect.</p>
          <Link to="/dashboard/browse-jobs"><Button variant="secondary" size="sm">← Back to jobs</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.navWordmark}>BuildMatch</Link>
        <Link to="/dashboard/browse-jobs" className={styles.navBack}>
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

            {/* Photos */}
            {job.photos.length > 0 && (
              <PhotoGallery photos={job.photos} />
            )}

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

            {/* Contract banner — pending signatures (both parties) */}
            {contractId && contractPendingSig && isParty && (
              <section className={styles.section}>
                <div className={styles.contractBanner}>
                  <AlertTriangle size={15} color="#D97706" strokeWidth={2} />
                  <div className={styles.contractBannerBody}>
                    <p className={styles.contractBannerTitle}>Contract pending — both parties must sign before work begins</p>
                    <p className={styles.contractBannerSub}>
                      Review the AI-generated contract and add your digital signature to activate it.
                    </p>
                  </div>
                  <Link to={`/contracts/${contractId}`} className={styles.contractBannerBtn}>
                    Review &amp; Sign
                  </Link>
                </div>
              </section>
            )}

            {/* View contract link — contractor who has bid, contract exists and active */}
            {isContractor && job.hasBid && contractId && existingContract?.status === 'ACTIVE' && (
              <section className={styles.section}>
                <div className={styles.contractActiveBanner}>
                  <CheckCircle2 size={15} color="#16A34A" strokeWidth={2.5} />
                  <p className={styles.contractActiveBannerText}>Contract is active</p>
                  <Link to={`/contracts/${contractId}`} className={styles.viewContractLink}>
                    View Contract →
                  </Link>
                </div>
              </section>
            )}

            {/* Active draw tracker — IN_PROGRESS, parties only */}
            {job.status === 'IN_PROGRESS' && isParty && user && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Payment Schedule</h2>
                <ActiveDrawTracker
                  jobId={job.id}
                  userRole={user.role as 'INVESTOR' | 'CONTRACTOR'}
                />
              </section>
            )}

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

            {/* AI-recommended contractors (investor/owner only) */}
            {isOwner && user && (
              <section className={styles.section}>
                <RecommendedContractors jobId={job.id} userId={user.id} />
              </section>
            )}

            {/* Bids (investor/owner only) */}
            {isOwner && (
              <section
                className={styles.section}
                ref={(el) => { bidsRef.current = el; }}
              >
                <h2 className={styles.sectionTitle}>Bids</h2>
                <BidAnalysisPanelErrorBoundary>
                  <BidAnalysisPanel
                    jobId={job.id}
                    bidCount={job.bidCount}
                    bids={(bids ?? [])
                      .filter((b) => b.contractor && (b.status === 'PENDING' || b.status === 'ACCEPTED'))
                      .map((b) => ({
                        contractorProfileId: b.contractor!.userId,
                        firstName:           b.contractor!.user.firstName,
                        lastName:            b.contractor!.user.lastName,
                        completedJobs:       b.contractor!.completedJobs ?? 0,
                        averageRating:       b.contractor!.averageRating,
                        amount:              b.amount,
                      }))}
                  />
                </BidAnalysisPanelErrorBoundary>
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
            {sidebarVariant === 'my-bid' && <MyBidCard jobId={job.id} investorId={job.investorId} jobStatus={job.status} />}
            {sidebarVariant === 'investor' && (
              <InvestorCard
                job={job}
                bidsRef={bidsRef}
                acceptedBidId={acceptedBid?.id}
                contractId={contractId}
                contractIsActive={existingContract?.status === 'ACTIVE'}
              />
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
