import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Star, AlertTriangle } from 'lucide-react';
import { useContractorMatching, type MatchedContractor } from '../../hooks/useContractorMatching';
import { getOrCreateConversation } from '../../services/message.service';
import BookmarkButton from '../ui/BookmarkButton';
import styles from './RecommendedContractors.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────

function scoreTier(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonAvatar} />
      <div className={styles.skeletonLine} style={{ height: 12, width: '60%', marginBottom: 8 }} />
      <div className={styles.skeletonLine} style={{ height: 10, width: '40%', marginBottom: 12 }} />
      <div className={styles.skeletonLine} style={{ height: 10, width: '80%', marginBottom: 6 }} />
      <div className={styles.skeletonLine} style={{ height: 10, width: '70%' }} />
    </div>
  );
}

// ── Contractor card ───────────────────────────────────────────────────────

interface ContractorCardProps {
  match:  MatchedContractor;
  jobId:  string;
  userId: string;
}

function ContractorMatchCard({ match, jobId, userId }: ContractorCardProps) {
  const navigate = useNavigate();
  const tier = scoreTier(match.matchScore);

  async function handleMessage() {
    try {
      const conversation = await getOrCreateConversation(jobId, match.contractorId);
      navigate(`/dashboard/messages/${conversation.id}`);
    } catch {
      // silently ignore — user can navigate manually
    }
  }

  return (
    <div className={styles.card}>
      <BookmarkButton
        contractorProfileId={match.contractorProfileId}
        size="sm"
        variant="icon"
        className={styles.bookmark}
      />

      {/* Top row: avatar + name + score badge */}
      <div className={styles.cardTop}>
        <div className={styles.cardIdentity}>
          {match.avatarUrl ? (
            <img
              src={match.avatarUrl}
              alt={match.firstName}
              className={styles.avatar}
            />
          ) : (
            <div className={styles.avatarFallback}>
              {initials(match.firstName, match.lastName)}
            </div>
          )}
          <div>
            <p className={styles.name}>{match.firstName} {match.lastName}</p>
            {(match.city || match.state) && (
              <p className={styles.location}>
                {[match.city, match.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Score badge with tooltip */}
        <div className={styles.tooltipWrap}>
          <span className={styles.scoreBadge} data-tier={tier}>
            {match.matchScore}% match
          </span>
          {match.matchExplanation && (
            <div className={styles.tooltip}>{match.matchExplanation}</div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <span className={styles.statItem}>
          <Star size={11} fill="#F59E0B" color="#F59E0B" />
          {match.averageRating.toFixed(1)}
        </span>
        <span className={styles.statItem}>
          {match.yearsExperience}y exp
        </span>
        <span className={styles.statItem}>
          {match.completedJobs} jobs
        </span>
      </div>

      {/* Specialties */}
      {match.specialties.length > 0 && (
        <div className={styles.specialties}>
          {match.specialties.slice(0, 3).map((s) => (
            <span key={s} className={styles.specialtyPill}>{s}</span>
          ))}
        </div>
      )}

      {/* AI match reasons */}
      {match.matchReasons.length > 0 && (
        <div className={styles.reasonsRow}>
          {match.matchReasons.slice(0, 3).map((r, i) => (
            <span key={i} className={styles.reasonPill}>{r}</span>
          ))}
        </div>
      )}

      {/* AI explanation */}
      {match.matchExplanation && (
        <p className={styles.explanation}>&ldquo;{match.matchExplanation}&rdquo;</p>
      )}

      {/* Actions */}
      <div className={styles.cardActions}>
        <Link
          to={`/contractors/${match.contractorProfileId}`}
          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
        >
          View Profile
        </Link>
        <button className={styles.actionBtn} onClick={handleMessage} type="button">
          Message
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  jobId:  string;
  userId: string;
}

export function RecommendedContractors({ jobId, userId }: Props) {
  const { matches, isLoading, isError } = useContractorMatching(jobId);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Sparkles size={18} className={styles.headerIcon} />
        <h3 className={styles.title}>AI-Recommended Contractors</h3>
      </div>
      <p className={styles.subtitle}>
        Ranked by specialty match, experience, and reliability for this job.
      </p>

      {isLoading && (
        <div className={styles.skeletonGrid}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {isError && (
        <div className={styles.errorCallout}>
          <AlertTriangle size={16} />
          Recommendations temporarily unavailable. You can still review bids below.
        </div>
      )}

      {!isLoading && !isError && matches.length === 0 && (
        <p className={styles.empty}>No contractor matches found for this job yet.</p>
      )}

      {!isLoading && !isError && matches.length > 0 && (
        <>
          <div className={styles.grid}>
            {matches.map((m) => (
              <ContractorMatchCard
                key={m.contractorId}
                match={m}
                jobId={jobId}
                userId={userId}
              />
            ))}
          </div>
          <p className={styles.disclosure}>
            Recommendations generated by Claude AI &middot; BuildMatch does not guarantee match accuracy
          </p>
        </>
      )}
    </div>
  );
}
