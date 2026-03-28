import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Star, AlertTriangle } from 'lucide-react';
import type { SearchedContractor } from '../../hooks/useContractorSearch';
import styles from './ContractorSearchResults.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────

function scoreTier(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonAvatar} />
      <div className={styles.skeletonLine} style={{ height: 12, width: '60%', marginBottom: 8 }} />
      <div className={styles.skeletonLine} style={{ height: 10, width: '40%', marginBottom: 12 }} />
      <div className={styles.skeletonLine} style={{ height: 10, width: '80%', marginBottom: 6 }} />
      <div className={styles.skeletonLine} style={{ height: 10, width: '70%', marginBottom: 16 }} />
      <div className={styles.skeletonLine} style={{ height: 32, width: '100%', borderRadius: 8 }} />
    </div>
  );
}

// ── Contractor card ───────────────────────────────────────────────────────

function ContractorCard({ c }: { c: SearchedContractor }) {
  const tier = scoreTier(c.matchScore);

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardIdentity}>
          {c.avatarUrl ? (
            <img src={c.avatarUrl} alt={c.firstName} className={styles.avatar} />
          ) : (
            <div className={styles.avatarFallback}>{initials(c.firstName, c.lastName)}</div>
          )}
          <div>
            <p className={styles.name}>{c.firstName} {c.lastName}</p>
            {(c.city || c.state) && (
              <p className={styles.location}>{[c.city, c.state].filter(Boolean).join(', ')}</p>
            )}
          </div>
        </div>
        <span className={styles.scoreBadge} data-tier={tier}>{c.matchScore}% match</span>
      </div>

      <div className={styles.statsRow}>
        <span className={styles.statItem}>
          <Star size={11} fill="#F59E0B" color="#F59E0B" />
          {c.averageRating.toFixed(1)}
        </span>
        <span className={styles.statItem}>{c.yearsExperience}y exp</span>
        <span className={styles.statItem}>{c.completedJobs} jobs</span>
      </div>

      {c.specialties.length > 0 && (
        <div className={styles.pills}>
          {c.specialties.slice(0, 3).map((s) => (
            <span key={s} className={styles.specialtyPill}>{s}</span>
          ))}
        </div>
      )}

      {c.matchReasons.length > 0 && (
        <div className={styles.pills}>
          {c.matchReasons.slice(0, 3).map((r, i) => (
            <span key={i} className={styles.reasonPill}>{r}</span>
          ))}
        </div>
      )}

      {c.matchExplanation && (
        <p className={styles.explanation}>&ldquo;{c.matchExplanation}&rdquo;</p>
      )}

      <div className={styles.cardActions}>
        <Link to={`/contractors/${c.contractorProfileId}`} className={styles.viewBtn}>
          View Profile
        </Link>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  query:     string;
  results:   SearchedContractor[] | null;
  isPending: boolean;
  isError:   boolean;
  onClear:   () => void;
}

export function ContractorSearchResults({ query, results, isPending, isError, onClear }: Props) {
  return (
    <section className={styles.root}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <Sparkles size={18} className={styles.sparkle} />
            <h2 className={styles.title}>
              AI-Matched Contractors{query && <> for <span className={styles.queryLabel}>&ldquo;{query}&rdquo;</span></>}
            </h2>
          </div>
          <button className={styles.clearBtn} onClick={onClear} type="button">
            Clear search
          </button>
        </div>

        {isPending && (
          <div className={styles.grid}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {isError && (
          <div className={styles.errorCallout}>
            <AlertTriangle size={16} />
            Search temporarily unavailable.
            <Link to="/contractors" className={styles.errorLink}>Browse all contractors →</Link>
          </div>
        )}

        {!isPending && !isError && results !== null && results.length === 0 && (
          <p className={styles.empty}>
            No contractors found for this search. Try a different description or{' '}
            <Link to="/contractors" className={styles.errorLink}>browse all contractors</Link>.
          </p>
        )}

        {!isPending && !isError && results && results.length > 0 && (
          <>
            <div className={styles.grid}>
              {results.map((c) => (
                <ContractorCard key={c.contractorId} c={c} />
              ))}
            </div>
            <p className={styles.disclosure}>
              Recommendations generated by Claude AI &middot; BuildMatch does not guarantee match accuracy
            </p>
          </>
        )}
      </div>
    </section>
  );
}
