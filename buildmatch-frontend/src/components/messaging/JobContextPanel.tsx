import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign, MapPin, Briefcase, Calendar,
  ExternalLink, AlertTriangle,
} from 'lucide-react';
import { getJobById } from '../../services/job.service';
import { getContractorById } from '../../services/contractor.service';
import { Avatar } from '../ui/Avatar';
import { StarRating } from '../ui/StarRating';
import { getOptimizedUrl } from '../../utils/media';
import type { Conversation } from '../../types/message.types';
import type { JobPost } from '../../types/job.types';
import type { ContractorProfile } from '../../types/contractor.types';
import styles from './JobContextPanel.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBudget(min: number, max: number): string {
  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
  return `${fmt(min)} – ${fmt(max)}`;
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0)  return 'Today';
  if (days === 1)  return 'Yesterday';
  if (days < 7)   return `${days} days ago`;
  if (days < 30)  return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'} ago`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? '' : 's'} ago`;
}

const TRADE_LABELS: Record<string, string> = {
  GENERAL: 'General', ELECTRICAL: 'Electrical', PLUMBING: 'Plumbing',
  HVAC: 'HVAC', ROOFING: 'Roofing', FLOORING: 'Flooring',
  PAINTING: 'Painting', LANDSCAPING: 'Landscaping',
  DEMOLITION: 'Demolition', OTHER: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open', AWARDED: 'Awarded', IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ width }: { width: string }) {
  return <div className={styles.skeleton} style={{ width, height: 13, borderRadius: 4 }} />;
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <p className={styles.sectionLabel}>{label}</p>;
}

// ── Job summary card ──────────────────────────────────────────────────────────

function JobCard({ job }: { job: JobPost }) {
  return (
    <div className={styles.jobCard}>
      <h2 className={styles.jobTitle}>{job.title}</h2>

      <div className={styles.badges}>
        <span className={styles.tradeBadge}>
          {TRADE_LABELS[job.tradeType] ?? job.tradeType}
        </span>
        <span className={`${styles.statusBadge} ${styles[`status_${job.status}`]}`}>
          {STATUS_LABELS[job.status] ?? job.status}
        </span>
      </div>

      <div className={styles.detailRows}>
        <DetailRow icon={<DollarSign size={13} strokeWidth={1.75} />} label="Budget">
          {formatBudget(job.budgetMin, job.budgetMax)}
        </DetailRow>
        <DetailRow icon={<MapPin size={13} strokeWidth={1.75} />} label="Location">
          {job.city}, {job.state}
        </DetailRow>
        <DetailRow icon={<Briefcase size={13} strokeWidth={1.75} />} label="Trade">
          {TRADE_LABELS[job.tradeType] ?? job.tradeType}
        </DetailRow>
        <DetailRow icon={<Calendar size={13} strokeWidth={1.75} />} label="Posted">
          {relativeDate(job.createdAt)}
        </DetailRow>
      </div>

      <Link to={`/jobs/${job.id}`} className={styles.viewJobLink}>
        View full job <ExternalLink size={12} strokeWidth={2} />
      </Link>
    </div>
  );
}

interface DetailRowProps {
  icon:     React.ReactNode;
  label:    string;
  children: React.ReactNode;
}

function DetailRow({ icon, label, children }: DetailRowProps) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailIcon}>{icon}</span>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{children}</span>
    </div>
  );
}

// ── Job photo preview ─────────────────────────────────────────────────────────

function JobPhotoPreview({ job }: { job: JobPost }) {
  if (!job.photos || job.photos.length === 0) return null;

  const firstPhoto = getOptimizedUrl(job.photos[0], 560, 80);
  const extraCount = job.photos.length - 1;

  return (
    <Link to={`/jobs/${job.id}`} className={styles.photoWrap}>
      <img
        src={firstPhoto}
        alt={job.title}
        className={styles.photo}
        loading="lazy"
      />
      {extraCount > 0 && (
        <span className={styles.photoMore}>+{extraCount} more</span>
      )}
    </Link>
  );
}

// ── Other user card ───────────────────────────────────────────────────────────

interface OtherUserCardProps {
  conversation: Conversation;
  contractorProfile: ContractorProfile | undefined;
}

function OtherUserCard({ conversation, contractorProfile }: OtherUserCardProps) {
  const { otherUser } = conversation;
  const name = `${otherUser.firstName} ${otherUser.lastName}`;
  const isContractor = otherUser.role === 'CONTRACTOR';

  return (
    <div className={styles.userCard}>
      <div className={styles.userCardTop}>
        <Avatar
          name={name}
          src={otherUser.avatarUrl ?? undefined}
          size="md"
        />
        <div className={styles.userInfo}>
          <p className={styles.userName}>{name}</p>
          <span className={`${styles.roleBadge} ${isContractor ? styles.roleContractor : styles.roleInvestor}`}>
            {isContractor ? 'Contractor' : 'Investor'}
          </span>
        </div>
      </div>

      {isContractor && contractorProfile && (
        <div className={styles.contractorStats}>
          <div className={styles.ratingRow}>
            <StarRating rating={contractorProfile.averageRating} size={13} />
            <span className={styles.ratingText}>
              {contractorProfile.averageRating.toFixed(1)}
              <span className={styles.ratingCount}>
                {' '}({contractorProfile.totalReviews} review{contractorProfile.totalReviews !== 1 ? 's' : ''})
              </span>
            </span>
          </div>
          {contractorProfile.completedJobs > 0 && (
            <p className={styles.completedJobs}>
              {contractorProfile.completedJobs} job{contractorProfile.completedJobs !== 1 ? 's' : ''} completed
            </p>
          )}
        </div>
      )}

      {isContractor ? (
        <Link to={`/contractors/${otherUser.id}`} className={styles.profileLink}>
          View profile <ExternalLink size={12} strokeWidth={2} />
        </Link>
      ) : null}
    </div>
  );
}

// ── Dispute callout ───────────────────────────────────────────────────────────

function DisputeCallout({ jobId }: { jobId: string }) {
  return (
    <div className={styles.disputeBox}>
      <AlertTriangle size={14} strokeWidth={2} className={styles.disputeIcon} />
      <div>
        <p className={styles.disputeTitle}>Having an issue with this job?</p>
        <Link to={`/jobs/${jobId}#dispute`} className={styles.disputeLink}>
          File a dispute
        </Link>
      </div>
    </div>
  );
}

// ── Skeleton state for the whole panel ───────────────────────────────────────

function PanelSkeleton() {
  return (
    <div className={styles.body}>
      <div className={styles.section}>
        <div className={styles.skeleton} style={{ width: '80%', height: 18, borderRadius: 4, marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <div className={styles.skeleton} style={{ width: 70, height: 22, borderRadius: 20 }} />
          <div className={styles.skeleton} style={{ width: 60, height: 22, borderRadius: 20 }} />
        </div>
        <SkeletonRow width="55%" />
        <div style={{ marginTop: 6 }} />
        <SkeletonRow width="65%" />
        <div style={{ marginTop: 6 }} />
        <SkeletonRow width="40%" />
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface JobContextPanelProps {
  conversation: Conversation;
  /** Override the root element's CSS class (e.g. when rendered inside a drawer). */
  className?:   string;
  /** Show the "About this job" panel header. Defaults to true. */
  showHeader?:  boolean;
}

export function JobContextPanel({ conversation, className, showHeader = true }: JobContextPanelProps) {
  const { jobId, otherUser } = conversation;
  const isContractor = otherUser.role === 'CONTRACTOR';

  const { data: job, isLoading: jobLoading } = useQuery<JobPost>({
    queryKey: ['jobs', jobId],
    queryFn:  () => getJobById(jobId),
    staleTime: 60_000,
  });

  const { data: contractorProfile } = useQuery<ContractorProfile>({
    queryKey: ['contractors', otherUser.id],
    queryFn:  () => getContractorById(otherUser.id),
    enabled:  isContractor,
    staleTime: 120_000,
  });

  return (
    <div className={className ?? styles.panel}>
      {/* ── Header ── */}
      {showHeader && (
        <div className={styles.header}>
          <h3 className={styles.headerTitle}>About this job</h3>
        </div>
      )}

      {jobLoading ? (
        <PanelSkeleton />
      ) : !job ? null : (
        <div className={styles.body}>

          {/* Job summary */}
          <div className={styles.section}>
            <JobCard job={job} />
          </div>

          {/* Job photo */}
          {job.photos && job.photos.length > 0 && (
            <div className={styles.section}>
              <JobPhotoPreview job={job} />
            </div>
          )}

          {/* Other user */}
          <div className={styles.section}>
            <SectionHeader label="You are talking to" />
            <OtherUserCard
              conversation={conversation}
              contractorProfile={contractorProfile}
            />
          </div>

          {/* Dispute (IN_PROGRESS only) */}
          {job.status === 'IN_PROGRESS' && (
            <div className={styles.section}>
              <DisputeCallout jobId={job.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
