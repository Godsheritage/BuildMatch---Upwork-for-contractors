import { Link } from 'react-router-dom';
import { MapPin, Users, User, Camera } from 'lucide-react';
import { useState } from 'react';
import type { JobPost } from '../../types/job.types';
import styles from './JobCard.module.css';
import { getOptimizedUrl, JOB_PHOTO_FALLBACK } from '../../utils/media';

// ── Constants ─────────────────────────────────────────────────────────────────

const TRADE_LABELS: Record<string, string> = {
  GENERAL:     'General Contractor',
  ELECTRICAL:  'Electrical',
  PLUMBING:    'Plumbing',
  HVAC:        'HVAC',
  ROOFING:     'Roofing',
  FLOORING:    'Flooring',
  PAINTING:    'Painting',
  LANDSCAPING: 'Landscaping',
  DEMOLITION:  'Demolition',
  OTHER:       'Other Trade',
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

// ── Utilities ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface JobCardProps {
  job: JobPost;
}

export function JobCard({ job }: JobCardProps) {
  const [heroError, setHeroError] = useState(false);
  const color    = TRADE_COLORS[job.tradeType] ?? TRADE_COLORS.OTHER;
  const label    = TRADE_LABELS[job.tradeType] ?? job.tradeType;
  const location = [job.city, job.state].filter(Boolean).join(', ');

  const heroPhoto = job.photos?.[0];

  return (
    <Link to={`/jobs/${job.id}`} className={styles.card}>

      {/* Hero image */}
      {heroPhoto && (
        <div className={styles.heroWrap}>
          <img
            src={heroError ? JOB_PHOTO_FALLBACK : getOptimizedUrl(heroPhoto, 1200, 85)}
            alt={job.title}
            className={styles.heroImg}
            loading="lazy"
            onError={() => setHeroError(true)}
          />
          {job.photos.length > 1 && (
            <span className={styles.photoBadge}>
              <Camera size={11} strokeWidth={2} />
              {job.photos.length}
            </span>
          )}
        </div>
      )}

      <div className={styles.cardBody}>

      {/* Top row: trade badge + time */}
      <div className={styles.topRow}>
        <span className={styles.tradeBadge} style={{ background: color.bg, color: color.text }}>
          {label}
        </span>
        <span className={styles.timePosted}>{timeAgo(job.createdAt)}</span>
      </div>

      {/* Title + location */}
      <div className={styles.titleRow}>
        <h3 className={styles.title}>{job.title}</h3>
        {location && (
          <p className={styles.location}>
            <MapPin size={12} strokeWidth={2} />
            {location}
          </p>
        )}
      </div>

      {/* Description — 3-line clamp */}
      <p className={styles.description}>{job.description}</p>

      {/* Stats */}
      <div className={styles.statsRow}>
        <span className={styles.budget}>
          ${job.budgetMin.toLocaleString()}–${job.budgetMax.toLocaleString()}
        </span>
        <span className={styles.stat}>
          <Users size={12} strokeWidth={2} />
          {job.bidCount} bid{job.bidCount !== 1 ? 's' : ''}
        </span>
        <span className={styles.stat}>
          <User size={12} strokeWidth={2} />
          Posted by {job.investor.firstName}
        </span>
      </div>

      {/* Bottom: View Job */}
      <div className={styles.bottomRow}>
        <span className={styles.viewJobLink}>View Job →</span>
      </div>

      </div>{/* /cardBody */}
    </Link>
  );
}
