import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, CheckCircle2, Briefcase, Clock, Shield, ChevronDown, X, ZoomIn, ChevronLeft, ChevronRight, Images, Star, CalendarDays, DollarSign, Timer, Quote, BookmarkCheck, FolderInput, Trash2, Eye } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getContractorById } from '../services/contractor.service';
import { getContractorReviews } from '../services/review.service';
import type { ReviewSort } from '../services/review.service';
import { requestTestimonial, getContractorTestimonials } from '../services/testimonial.service';
import type { Testimonial } from '../services/testimonial.service';
import { getMyJobs } from '../services/job.service';
import { getOrCreateConversation } from '../services/message.service';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import BookmarkButton from '../components/ui/BookmarkButton';
import { useSavedContractors } from '../context/SavedContractorsContext';
import { useSavedLists, useListContractors } from '../hooks/useSavedContractors';
import api from '../services/api';
import { StarRating } from '../components/ui/StarRating';
import { ReliabilityScoreBadge } from '../components/contractor/ReliabilityScoreBadge';
import type { ContractorProfile, PortfolioProject } from '../types/contractor.types';
import type { Review, ReviewBreakdown } from '../types/review.types';
import styles from './ContractorProfilePage.module.css';
import { getOptimizedUrl, JOB_PHOTO_FALLBACK } from '../utils/media';

// ── Constants ──────────────────────────────────────────────────────────────

const SPECIALTY_LABELS: Record<string, string> = {
  GENERAL:     'General Contractor',
  ELECTRICAL:  'Electrician',
  PLUMBING:    'Plumber',
  HVAC:        'HVAC',
  ROOFING:     'Roofer',
  FLOORING:    'Flooring',
  PAINTING:    'Painter',
  LANDSCAPING: 'Landscaper',
  DEMOLITION:  'Demolition',
  OTHER:       'Other Trade',
};

const AVATAR_COLORS = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FEE2E2', text: '#991B1B' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#E0F2FE', text: '#0369A1' },
];

function getAvatarColor(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

// ── Large avatar (96px — beyond what the Avatar ui component supports) ─────

function LargeAvatar({ name, src }: { name: string; src?: string }) {
  const [imgError, setImgError] = useState(false);
  const color = getAvatarColor(name);
  const showImg = src && !imgError;
  return (
    <div
      style={{
        width: 96, height: 96, borderRadius: '50%',
        background: showImg ? 'transparent' : color.bg,
        color: color.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, fontWeight: 600,
        flexShrink: 0, userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {showImg ? (
        <img
          src={getOptimizedUrl(src!, 192)}
          alt={name}
          loading="lazy"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}

// ── Skeleton loading layout ────────────────────────────────────────────────

function PageSkeleton() {
  const block = (w: number | string, h: number, style?: React.CSSProperties) => (
    <div className={styles.skeleton} style={{ width: w, height: h, borderRadius: 4, ...style }} />
  );
  return (
    <div className={styles.wrap}>
      {/* Sidebar skeleton */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarCard} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {block(72, 72, { borderRadius: '50%' })}
          {block('60%', 18)}
          {block('40%', 13)}
          {block('50%', 13)}
          {block('100%', 38, { marginTop: 4 })}
          {block('100%', 38)}
        </div>
      </div>
      {/* Content skeleton */}
      <div className={styles.content}>
        {[130, 110, 150].map((h, i) => (
          <div
            key={i}
            className={styles.section}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: h }}
          >
            {block('30%', 15)}
            {block('100%', 13)}
            {block('85%', 13)}
            {block('70%', 13)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Not found state ────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
        Contractor not found
      </p>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>
        This profile may have been removed or the link is incorrect.
      </p>
      <Link to="/contractors">
        <Button variant="secondary" size="sm">← Back to contractors</Button>
      </Link>
    </div>
  );
}

// ── Contact modal (investor job picker) ────────────────────────────────────

function ContactModal({
  open,
  onClose,
  contractorUserId,
}: {
  open: boolean;
  onClose: () => void;
  contractorUserId: string;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedJobId, setSelectedJobId] = useState('');
  const [isStarting, setIsStarting]       = useState(false);

  const { data: myJobs = [], isLoading } = useQuery({
    queryKey: ['jobs', 'my-jobs'],
    queryFn:  getMyJobs,
    enabled:  open,
    staleTime: 30_000,
  });

  const openJobs = myJobs.filter((j) => j.status === 'OPEN');

  async function handleStart() {
    if (!selectedJobId || isStarting) return;
    setIsStarting(true);
    try {
      const conv = await getOrCreateConversation(selectedJobId, contractorUserId);
      navigate(`/dashboard/messages/${conv.id}`);
      onClose();
    } catch {
      toast('Could not open conversation. Please try again.', 'error');
    } finally {
      setIsStarting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 'var(--radius-md)',
          padding: 24, width: '100%', maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', padding: 4, lineHeight: 0,
          }}
          aria-label="Close"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Message Contractor
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
          Select one of your open jobs to start a conversation.
        </p>

        {isLoading ? (
          <div style={{ height: 40, background: '#EFEFED', borderRadius: 8, animation: 'pulse 1.6s ease-in-out infinite' }} />
        ) : openJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
              You need an open job to message a contractor.
            </p>
            <Link to="/dashboard/post-job" onClick={onClose}>
              <Button variant="primary" size="sm">Post a Job</Button>
            </Link>
          </div>
        ) : (
          <>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              style={{
                width: '100%', height: 40, padding: '0 12px',
                border: '1.5px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 14, color: 'var(--color-text-primary)',
                background: '#fff', fontFamily: 'var(--font-family)',
                marginBottom: 16, outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">Choose a job…</option>
              {openJobs.map((job) => (
                <option key={job.id} value={job.id}>{job.title}</option>
              ))}
            </select>
            <Button
              variant="primary"
              className="w-full justify-center"
              disabled={!selectedJobId || isStarting}
              onClick={handleStart}
            >
              {isStarting ? 'Opening…' : 'Start Conversation'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Profile sidebar ────────────────────────────────────────────────────────

// ── Saved indicator (shown when contractor is already saved) ──────────────

function SavedIndicator({ contractorProfileId }: { contractorProfileId: string }) {
  const { isSaved, getListId, toggle } = useSavedContractors();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const saved = isSaved(contractorProfileId);
  const currentListId = getListId(contractorProfileId) ?? null;

  const { data: listsData } = useSavedLists();
  const lists = Array.isArray(listsData) ? (listsData as { id: string; name: string; isDefault: boolean }[]) : [];
  const currentList = lists.find((l) => l.id === currentListId);
  const otherLists  = lists.filter((l) => l.id !== currentListId);

  // Fetch saved row for this contractor (to get savedId for move)
  const { data: listContractors = [] } = useListContractors(open ? currentListId : null) as { data: { id: string; contractorProfileId: string }[] };
  const savedId = listContractors.find((sc) => sc.contractorProfileId === contractorProfileId)?.id;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMoveOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!saved) return null;

  async function handleRemove() {
    await toggle(contractorProfileId);
    qc.invalidateQueries({ queryKey: ['saved-lists'] });
    setOpen(false);
  }

  async function handleMove(targetListId: string) {
    if (!savedId) return;
    try {
      await api.put(`/saved/contractors/${savedId}/move`, { targetListId });
      qc.invalidateQueries({ queryKey: ['saved-list-contractors', currentListId] });
      qc.invalidateQueries({ queryKey: ['saved-lists'] });
      const target = lists.find((l) => l.id === targetListId);
      toast(`Moved to ${target?.name ?? 'list'}`, 'success');
    } catch {
      toast('Could not move contractor. Please try again.', 'error');
    }
    setOpen(false);
    setMoveOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          width: '100%', padding: '8px 14px',
          background: 'var(--color-highlight)', border: '1px solid #A7F3D0',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: 'var(--color-accent)',
          fontFamily: 'var(--font-family)',
        }}
      >
        <BookmarkCheck size={15} strokeWidth={2} />
        Saved to {currentList?.name ?? 'My Contractors'}
        <ChevronDown size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
          zIndex: 30, overflow: 'hidden',
        }}>
          {/* Current list label */}
          <div style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 600,
            color: 'var(--color-text-muted)', textTransform: 'uppercase',
            letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)',
          }}>
            Saved in
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 14px', fontSize: 13, color: 'var(--color-accent)',
          }}>
            <BookmarkCheck size={13} strokeWidth={2} />
            {currentList?.name ?? 'My Saved Contractors'}
          </div>

          {/* Move submenu */}
          {otherLists.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                onClick={() => setMoveOpen((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '9px 14px', background: 'none', border: 'none',
                  fontSize: 13, color: 'var(--color-text-primary)', cursor: 'pointer',
                  fontFamily: 'var(--font-family)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <FolderInput size={13} /> Move to a different list
                </span>
                <ChevronDown size={12} style={{ opacity: 0.5, transform: moveOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
              {moveOpen && otherLists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleMove(l.id)}
                  style={{
                    display: 'block', width: '100%', padding: '7px 14px 7px 34px',
                    background: 'none', border: 'none', fontSize: 13,
                    color: 'var(--color-text-primary)', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'var(--font-family)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}

          {/* Remove */}
          <div style={{ borderTop: '1px solid var(--color-border)' }}>
            <button
              type="button"
              onClick={handleRemove}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                width: '100%', padding: '9px 14px', background: 'none', border: 'none',
                fontSize: 13, color: 'var(--color-danger)', cursor: 'pointer',
                fontFamily: 'var(--font-family)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#FEF2F2')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <Trash2 size={13} /> Remove from saved list
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileSidebar({
  contractor,
  onContactClick,
  isOwnProfile,
  onRequestTestimonial,
}: {
  contractor: ContractorProfile;
  onContactClick: () => void;
  isOwnProfile: boolean;
  onRequestTestimonial: () => void;
}) {
  const fullName = `${contractor.user.firstName} ${contractor.user.lastName}`;
  const location = [contractor.city, contractor.state].filter(Boolean).join(', ');
  const hasRate = contractor.hourlyRateMin != null || contractor.hourlyRateMax != null;
  const hasRating = contractor.averageRating > 0;

  return (
    <div className={styles.sidebarCard}>
      {/* Avatar + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
        <LargeAvatar name={fullName} src={contractor.avatarUrl ?? undefined} />
        <h1
          style={{
            fontSize: 20, fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
            marginTop: 12, marginBottom: 6,
          }}
        >
          {fullName}
        </h1>

        {/* Star rating */}
        {hasRating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <StarRating rating={contractor.averageRating} size={13} />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              ({contractor.totalReviews} review{contractor.totalReviews !== 1 ? 's' : ''})
            </span>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>No reviews yet</p>
        )}

        {/* Reliability score badge */}
        {contractor.reliabilityScore != null && contractor.reliabilityScore > 0 && (
          <div style={{ marginBottom: 8 }}>
            <ReliabilityScoreBadge score={contractor.reliabilityScore} size="lg" />
          </div>
        )}

        {/* Location */}
        {location && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <MapPin size={12} strokeWidth={2} />
            {location}
          </p>
        )}
      </div>

      {/* Availability + rate */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Availability</span>
          <span
            style={{
              fontSize: 12, fontWeight: 500,
              padding: '2px 10px', borderRadius: 'var(--radius-pill)',
              background: contractor.isAvailable ? 'var(--color-highlight)' : 'var(--color-surface)',
              color: contractor.isAvailable ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}
          >
            {contractor.isAvailable ? 'Available' : 'Unavailable'}
          </span>
        </div>

        {hasRate && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Hourly rate</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              ${contractor.hourlyRateMin ?? '?'}–${contractor.hourlyRateMax ?? '?'}/hr
            </span>
          </div>
        )}
      </div>

      {/* CTA buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <Button
          variant="primary"
          className="w-full justify-center"
          onClick={onContactClick}
        >
          Message Contractor
        </Button>
        {isOwnProfile && (
          <button
            onClick={onRequestTestimonial}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              width: '100%', padding: '9px 0',
              background: 'none', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-family)',
              color: 'var(--color-text-primary)', cursor: 'pointer',
              transition: 'background 0.13s, border-color 0.13s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.borderColor = 'var(--color-text-muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none';                  e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          >
            <Quote size={14} strokeWidth={2} />
            Request testimonial
          </button>
        )}
        <SavedIndicator contractorProfileId={contractor.id} />
        <BookmarkButton
          contractorProfileId={contractor.id}
          size="lg"
          variant="icon-label"
          className="w-full justify-center"
        />
      </div>

      {/* License badge */}
      {contractor.licenseNumber && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 12px',
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
          }}
        >
          <CheckCircle2 size={14} color="#16A34A" strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#15803D' }}>
            Licensed{contractor.licenseState ? ` · ${contractor.licenseState}` : ''}
          </span>
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--color-border)', marginBottom: 16 }} />

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCell}>
          <p className={styles.statValue}>{contractor.completedJobs}</p>
          <p className={styles.statLabel}>Jobs Done</p>
        </div>
        <div className={styles.statCell}>
          <p className={styles.statValue}>
            {hasRating ? contractor.averageRating.toFixed(1) : '—'}
          </p>
          <p className={styles.statLabel}>Avg Rating</p>
        </div>
        <div className={styles.statCell}>
          <p className={styles.statValue}>{'<1d'}</p>
          <p className={styles.statLabel}>Response</p>
        </div>
      </div>
    </div>
  );
}

// ── Reviews section ────────────────────────────────────────────────────────

const SORT_LABELS: Record<ReviewSort, string> = {
  newest:  'Newest',
  highest: 'Highest rated',
  lowest:  'Lowest rated',
};

const TRADE_LABELS: Record<string, string> = {
  GENERAL: 'General', ELECTRICAL: 'Electrical', PLUMBING: 'Plumbing',
  HVAC: 'HVAC', ROOFING: 'Roofing', FLOORING: 'Flooring',
  PAINTING: 'Painting', LANDSCAPING: 'Landscaping', DEMOLITION: 'Demolition',
  OTHER: 'Other',
};

function ReviewCard({ review }: { review: Review }) {
  const name = `${review.reviewer.firstName} ${review.reviewer.lastName}`;
  const color = getAvatarColor(name);
  const initials = getInitials(name);
  const date = new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const trade = review.job?.tradeType ? (TRADE_LABELS[review.job.tradeType] ?? review.job.tradeType) : null;

  return (
    <div className={styles.reviewCard}>
      <div className={styles.reviewHeader}>
        <div className={styles.reviewerRow}>
          <div
            className={styles.reviewerAvatar}
            style={{ background: color.bg, color: color.text }}
          >
            {initials}
          </div>
          <div>
            <p className={styles.reviewerName}>{name}</p>
            <p className={styles.reviewDate}>{date}</p>
          </div>
        </div>
        <div className={styles.reviewMeta}>
          <StarRating rating={review.rating} size={12} />
          {trade && <span className={styles.tradeBadge}>{trade}</span>}
        </div>
      </div>
      <p className={styles.reviewTitle}>{review.title}</p>
      <p className={styles.reviewBody}>{review.body}</p>
    </div>
  );
}

// ── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);
  const [imgError, setImgError] = useState(false);

  const prev = useCallback(() => {
    setImgError(false);
    setCurrent((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    setImgError(false);
    setCurrent((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  return (
    <div className={styles.lightboxOverlay} onClick={onClose}>
      {/* Close */}
      <button className={styles.lightboxClose} onClick={onClose} aria-label="Close">
        <X size={20} strokeWidth={2} />
      </button>

      {/* Counter */}
      <span className={styles.lightboxCounter}>{current + 1} / {images.length}</span>

      {/* Prev */}
      {images.length > 1 && (
        <button
          className={`${styles.lightboxNav} ${styles.lightboxNavLeft}`}
          onClick={(e) => { e.stopPropagation(); prev(); }}
          aria-label="Previous"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
      )}

      {/* Image */}
      <div className={styles.lightboxImgWrap} onClick={(e) => e.stopPropagation()}>
        <img
          key={current}
          src={imgError ? JOB_PHOTO_FALLBACK : images[current]}
          alt={`Portfolio ${current + 1}`}
          className={styles.lightboxImg}
          onError={() => setImgError(true)}
        />
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          className={`${styles.lightboxNav} ${styles.lightboxNavRight}`}
          onClick={(e) => { e.stopPropagation(); next(); }}
          aria-label="Next"
        >
          <ChevronRight size={22} strokeWidth={2} />
        </button>
      )}

      {/* Dot strip */}
      {images.length > 1 && (
        <div className={styles.lightboxDots}>
          {images.map((_, i) => (
            <button
              key={i}
              className={`${styles.lightboxDot} ${i === current ? styles.lightboxDotActive : ''}`}
              onClick={(e) => { e.stopPropagation(); setImgError(false); setCurrent(i); }}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Portfolio project card ───────────────────────────────────────────────────

const TRADE_COLORS: Record<string, { bg: string; text: string }> = {
  GENERAL:     { bg: '#EFF6FF', text: '#1D4ED8' },
  ELECTRICAL:  { bg: '#FEF9C3', text: '#854D0E' },
  PLUMBING:    { bg: '#E0F2FE', text: '#0369A1' },
  HVAC:        { bg: '#F0FDF4', text: '#166534' },
  ROOFING:     { bg: '#FEF3C7', text: '#92400E' },
  FLOORING:    { bg: '#F5F3FF', text: '#6D28D9' },
  PAINTING:    { bg: '#FDF2F8', text: '#9D174D' },
  LANDSCAPING: { bg: '#ECFDF5', text: '#065F46' },
  DEMOLITION:  { bg: '#FFF1F2', text: '#9F1239' },
  OTHER:       { bg: '#F3F4F6', text: '#374151' },
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map((s) => (
        <Star
          key={s}
          size={13}
          strokeWidth={1.5}
          fill={s <= rating ? 'var(--color-star)' : 'none'}
          color={s <= rating ? 'var(--color-star)' : 'var(--color-border)'}
        />
      ))}
    </div>
  );
}

function ProjectCard({ project, onPhotoClick }: { project: PortfolioProject; onPhotoClick: (photos: string[], idx: number) => void }) {
  const [photoErr, setPhotoErr] = useState<Record<number, boolean>>({});
  const tradeColor = TRADE_COLORS[project.tradeType] ?? TRADE_COLORS.OTHER;
  const completedDate = new Date(project.completedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const budgetStr = project.budgetMin === project.budgetMax
    ? `$${project.budgetMin.toLocaleString()}`
    : `$${project.budgetMin.toLocaleString()} – $${project.budgetMax.toLocaleString()}`;

  return (
    <div className={styles.projectCard}>
      {/* Photo strip */}
      <div className={styles.projectPhotos}>
        {project.photos.map((url, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.projectPhotoCell} ${i === 0 ? styles.projectPhotoCellMain : styles.projectPhotoCellThumb}`}
            onClick={() => onPhotoClick(project.photos, i)}
            aria-label={`View photo ${i + 1}`}
          >
            <img
              src={photoErr[i] ? JOB_PHOTO_FALLBACK : url}
              alt={`${project.title} photo ${i + 1}`}
              className={styles.projectPhotoImg}
              loading="lazy"
              onError={() => setPhotoErr((e) => ({ ...e, [i]: true }))}
            />
            <div className={styles.projectPhotoOverlay}>
              <ZoomIn size={18} strokeWidth={1.75} color="#fff" />
            </div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={styles.projectBody}>
        {/* Title row */}
        <div className={styles.projectTitleRow}>
          <h3 className={styles.projectTitle}>{project.title}</h3>
          <span
            className={styles.projectTradeBadge}
            style={{ background: tradeColor.bg, color: tradeColor.text }}
          >
            {SPECIALTY_LABELS[project.tradeType] ?? project.tradeType}
          </span>
        </div>

        {/* Meta row */}
        <div className={styles.projectMeta}>
          <span className={styles.projectMetaItem}>
            <MapPin size={12} strokeWidth={2} />
            {project.city}, {project.state}
          </span>
          <span className={styles.projectMetaItem}>
            <CalendarDays size={12} strokeWidth={2} />
            Completed {completedDate}
          </span>
          <span className={styles.projectMetaItem}>
            <Timer size={12} strokeWidth={2} />
            {project.durationWeeks} week{project.durationWeeks !== 1 ? 's' : ''}
          </span>
          <span className={styles.projectMetaItem}>
            <DollarSign size={12} strokeWidth={2} />
            {budgetStr}
          </span>
        </div>

        {/* Description */}
        <p className={styles.projectDesc}>{project.description}</p>

        {/* Highlights */}
        {project.highlights.length > 0 && (
          <div className={styles.projectHighlights}>
            {project.highlights.map((h) => (
              <span key={h} className={styles.projectHighlight}>
                <CheckCircle2 size={11} strokeWidth={2.5} color="var(--color-accent)" />
                {h}
              </span>
            ))}
          </div>
        )}

        {/* Client review */}
        {project.clientReview && (
          <div className={styles.projectReview}>
            <div className={styles.projectReviewTop}>
              <Quote size={14} strokeWidth={1.5} color="var(--color-accent)" />
              <StarRow rating={project.clientRating} />
              <span className={styles.projectReviewClient}>{project.clientName}</span>
            </div>
            <p className={styles.projectReviewText}>"{project.clientReview}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Portfolio section ────────────────────────────────────────────────────────

const PAGE_SIZE = 3;

function PortfolioSection({ projects }: { projects: PortfolioProject[] }) {
  const [page, setPage]         = useState(0);
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);

  const totalPages = Math.ceil(projects.length / PAGE_SIZE);
  const visible    = projects.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div className={styles.projectList}>
        {visible.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            onPhotoClick={(photos, idx) => setLightbox({ photos, idx })}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className={styles.projectPagination}>
          <button
            className={styles.projectPageBtn}
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            aria-label="Previous projects"
          >
            <ChevronLeft size={15} strokeWidth={2} />
            Previous
          </button>

          <div className={styles.projectPageDots}>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                className={`${styles.projectPageDot} ${i === page ? styles.projectPageDotActive : ''}`}
                onClick={() => setPage(i)}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>

          <button
            className={styles.projectPageBtn}
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages - 1}
            aria-label="Next projects"
          >
            Next
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.photos}
          startIndex={lightbox.idx}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

function ReviewsSection({ contractorUserId, totalReviews }: { contractorUserId: string; totalReviews: number }) {
  const [sort, setSort]       = useState<ReviewSort>('newest');
  const [page, setPage]       = useState(1);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [sortOpen, setSortOpen]     = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ['contractors', contractorUserId, 'reviews', sort, page],
    queryFn: () => getContractorReviews(contractorUserId, { sort, page, limit: 5 }),
    staleTime: 60_000,
    enabled: totalReviews > 0,
  });

  // Accumulate reviews across load-more pages; reset when sort changes
  const [lastSort, setLastSort] = useState<ReviewSort>(sort);
  if (sort !== lastSort) {
    setAllReviews([]);
    setLastSort(sort);
  }
  if (data && data.reviews.length > 0) {
    const ids = new Set(allReviews.map((r) => r.id));
    const fresh = data.reviews.filter((r) => !ids.has(r.id));
    if (fresh.length > 0) setAllReviews((prev) => [...prev, ...fresh]);
  }

  const breakdown: ReviewBreakdown[] = data?.breakdown ?? [];
  const maxCount = useMemo(() => Math.max(...breakdown.map((b) => b.count), 1), [breakdown]);
  const avgRating = data ? (breakdown.reduce((s, b) => s + b.rating * b.count, 0) / (breakdown.reduce((s, b) => s + b.count, 0) || 1)) : 0;

  const hasMore = data ? page < data.totalPages : false;

  function handleSort(s: ReviewSort) {
    setSort(s);
    setPage(1);
    setSortOpen(false);
  }

  if (totalReviews === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Reviews</h2>

      {/* Summary row */}
      <div className={styles.reviewSummary}>
        <div className={styles.reviewSummaryLeft}>
          <span className={styles.reviewBigRating}>{avgRating.toFixed(1)}</span>
          <div>
            <StarRating rating={avgRating} size={16} />
            <p className={styles.reviewCount}>Based on {totalReviews} review{totalReviews !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className={styles.breakdownList}>
          {[5, 4, 3, 2, 1].map((star) => {
            const entry = breakdown.find((b) => b.rating === star);
            const count = entry?.count ?? 0;
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div key={star} className={styles.breakdownRow}>
                <span className={styles.breakdownStar}>{star}</span>
                <div className={styles.breakdownTrack}>
                  <div className={styles.breakdownFill} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.breakdownCount}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sort dropdown */}
      <div className={styles.reviewToolbar}>
        <div className={styles.sortWrap}>
          <button
            type="button"
            className={styles.sortBtn}
            onClick={() => setSortOpen((o) => !o)}
          >
            {SORT_LABELS[sort]}
            <ChevronDown size={13} strokeWidth={2} />
          </button>
          {sortOpen && (
            <div className={styles.sortMenu}>
              {(Object.keys(SORT_LABELS) as ReviewSort[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.sortOption} ${s === sort ? styles.sortOptionActive : ''}`}
                  onClick={() => handleSort(s)}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review cards */}
      <div className={styles.reviewList}>
        {allReviews.map((r) => <ReviewCard key={r.id} review={r} />)}
      </div>

      {/* Load more */}
      {hasMore && (
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="secondary"
            size="sm"
            disabled={isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            {isFetching ? 'Loading…' : 'Load more reviews'}
          </Button>
        </div>
      )}
    </section>
  );
}

// ── Request Testimonial Modal ──────────────────────────────────────────────

function RequestTestimonialModal({
  open,
  onClose,
  contractorUserId,
}: {
  open: boolean;
  onClose: () => void;
  contractorUserId: string;
}) {
  const { toast } = useToast();
  const [email,        setEmail]        = useState('');
  const [name,         setName]         = useState('');
  const [message,      setMessage]      = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success,      setSuccess]      = useState(false);

  if (!open) return null;

  function handleClose() {
    setEmail(''); setName(''); setMessage('');
    setSuccess(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await requestTestimonial(contractorUserId, {
        recipientEmail:  email.trim(),
        recipientName:   name.trim(),
        personalMessage: message.trim() || undefined,
      });
      setSuccess(true);
    } catch {
      toast('Could not send request. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', fontSize: 14,
    fontFamily: 'var(--font-family)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    color: 'var(--color-text-primary)',
    background: 'var(--color-bg)',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 'var(--radius-md)',
          padding: 28, width: '100%', maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            Request a testimonial
          </h2>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4, lineHeight: 0 }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircle2 size={40} color="var(--color-accent)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>Request sent!</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              We've sent a testimonial request to <strong>{email}</strong>.<br />
              It will appear on your profile once they submit it.
            </p>
            <button
              onClick={handleClose}
              style={{
                marginTop: 20, padding: '8px 20px',
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-family)', cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
              Enter the email of someone you've worked with and we'll send them a link to leave a testimonial on your profile.
            </p>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>
                Their name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>
                Their email <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="email"
                required
                placeholder="e.g. jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', display: 'block', marginBottom: 5 }}>
                Personal message (optional)
              </label>
              <textarea
                placeholder="Add a personal note to your request…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={500}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !email.trim() || !name.trim()}
              style={{
                padding: '10px 0',
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-sm)',
                fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-family)',
                cursor: isSubmitting || !email.trim() || !name.trim() ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || !email.trim() || !name.trim() ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {isSubmitting ? 'Sending…' : 'Send request'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Testimonials section ───────────────────────────────────────────────────

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const color    = getAvatarColor(testimonial.authorName);
  const initials = getInitials(testimonial.authorName);
  const date     = new Date(testimonial.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div className={styles.reviewCard}>
      <div className={styles.reviewHeader}>
        <div className={styles.reviewerRow}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: color.bg, color: color.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <p className={styles.reviewerName}>{testimonial.authorName}</p>
            <p className={styles.reviewDate}>{date}</p>
          </div>
        </div>
        <Quote size={16} color="var(--color-border)" strokeWidth={1.5} />
      </div>
      <p className={styles.reviewBody}>{testimonial.body}</p>
    </div>
  );
}

function TestimonialsSection({ contractorUserId }: { contractorUserId: string }) {
  const { data: testimonials = [], isLoading } = useQuery({
    queryKey: ['contractors', contractorUserId, 'testimonials'],
    queryFn:  () => getContractorTestimonials(contractorUserId),
    staleTime: 60_000,
  });

  if (!isLoading && testimonials.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Testimonials</h2>
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ height: 100, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', animation: 'pulse 1.6s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <div className={styles.reviewList}>
          {testimonials.map((t) => <TestimonialCard key={t.id} testimonial={t} />)}
        </div>
      )}
    </section>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function ContractorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [contactModalOpen,      setContactModalOpen]      = useState(false);
  const [testimonialModalOpen,  setTestimonialModalOpen]  = useState(false);

  const { data: contractor, isLoading, isError } = useQuery({
    queryKey: ['contractors', id],
    queryFn: () => getContractorById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });

  const isPreview    = searchParams.get('preview') === 'true' && !!user && !!contractor && user.id === contractor.userId;
  const isOwnProfile = !!user && !!contractor && user.id === contractor.userId;

  return (
    <div className={styles.page}>
      {/* Preview banner */}
      {isPreview && (
        <div className={styles.previewBanner}>
          <div className={styles.previewBannerLeft}>
            <Eye size={15} strokeWidth={2} />
            <span>Preview mode — this is exactly how investors see your public profile</span>
          </div>
          <a
            href="/dashboard/profile"
            className={styles.previewBannerBack}
            onClick={(e) => { e.preventDefault(); window.close(); }}
          >
            <ArrowLeft size={13} strokeWidth={2} />
            Back to your profile
          </a>
        </div>
      )}

      {/* Navbar */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.navWordmark}>BuildMatch</Link>
        {isPreview ? (
          <a
            href="/dashboard/profile"
            className={styles.navBack}
            onClick={(e) => { e.preventDefault(); window.close(); }}
          >
            <ArrowLeft size={14} strokeWidth={2} />
            My profile
          </a>
        ) : (
          <Link to="/contractors" className={styles.navBack}>
            <ArrowLeft size={14} strokeWidth={2} />
            All contractors
          </Link>
        )}
      </nav>

      {isLoading && <PageSkeleton />}
      {(isError || (!isLoading && !contractor)) && <NotFound />}

      {contractor && user?.role === 'INVESTOR' && (
        <ContactModal
          open={contactModalOpen}
          onClose={() => setContactModalOpen(false)}
          contractorUserId={contractor.userId}
        />
      )}
      {contractor && isOwnProfile && (
        <RequestTestimonialModal
          open={testimonialModalOpen}
          onClose={() => setTestimonialModalOpen(false)}
          contractorUserId={contractor.userId}
        />
      )}

      {contractor && (
        <div className={styles.wrap}>
          {/* Left sidebar */}
          <aside className={styles.sidebar}>
            <ProfileSidebar
              contractor={contractor}
              onContactClick={() => setContactModalOpen(true)}
              isOwnProfile={isOwnProfile}
              onRequestTestimonial={() => setTestimonialModalOpen(true)}
            />
          </aside>

          {/* Right content */}
          <div className={styles.content}>

            {/* About */}
            {contractor.bio && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>About</h2>
                <p
                  style={{
                    fontSize: 14, color: 'var(--color-text-muted)',
                    lineHeight: 1.75, whiteSpace: 'pre-wrap',
                  }}
                >
                  {contractor.bio}
                </p>
              </section>
            )}

            {/* Specialties */}
            {contractor.specialties.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Specialties</h2>
                <div className={styles.pills}>
                  {contractor.specialties.map((s) => (
                    <span key={s} className={styles.pill}>
                      {SPECIALTY_LABELS[s] ?? s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Experience */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Experience</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Years */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Briefcase size={16} color="var(--color-text-muted)" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {contractor.yearsExperience > 0
                        ? `${contractor.yearsExperience} year${contractor.yearsExperience !== 1 ? 's' : ''} of experience`
                        : 'Experience not specified'}
                    </p>
                    {contractor.completedJobs > 0 && (
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {contractor.completedJobs} job{contractor.completedJobs !== 1 ? 's' : ''} completed on BuildMatch
                      </p>
                    )}
                  </div>
                </div>

                {/* License */}
                {contractor.licenseNumber && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Shield size={16} color="var(--color-text-muted)" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {contractor.licenseState
                          ? `Licensed in ${contractor.licenseState}`
                          : 'Licensed contractor'}
                        {contractor.isLicenseVerified && (
                          <CheckCircle2
                            size={13}
                            color="#16A34A"
                            strokeWidth={2}
                            style={{ display: 'inline', marginLeft: 6, verticalAlign: 'middle' }}
                          />
                        )}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        License #{contractor.licenseNumber}
                        {!contractor.isLicenseVerified && ' · Pending verification'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Insurance */}
                {contractor.insuranceExpiry && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Clock size={16} color="var(--color-text-muted)" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        Insured
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Coverage expires{' '}
                        {new Date(contractor.insuranceExpiry).toLocaleDateString('en-US', {
                          month: 'long', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Portfolio */}
            {(() => {
              const projects = contractor.portfolioProjects ?? [];
              return (
                <section className={styles.section}>
                  <div className={styles.portfolioHeader}>
                    <h2 className={styles.sectionTitle} style={{ margin: 0, border: 'none', padding: 0 }}>Portfolio</h2>
                    {projects.length > 0 && (
                      <span className={styles.portfolioCount}>
                        <Images size={13} strokeWidth={1.75} />
                        {projects.length} project{projects.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className={styles.portfolioDivider} />
                  {projects.length > 0 ? (
                    <PortfolioSection projects={projects} />
                  ) : (
                    <div className={styles.portfolioEmpty}>
                      <Images size={32} strokeWidth={1.25} color="var(--color-border)" />
                      <p>No portfolio projects yet.</p>
                    </div>
                  )}
                </section>
              );
            })()}

            {/* Reviews */}
            <ReviewsSection
              contractorUserId={contractor.userId}
              totalReviews={contractor.totalReviews}
            />

            {/* Testimonials */}
            <TestimonialsSection contractorUserId={contractor.userId} />

          </div>
        </div>
      )}
    </div>
  );
}
