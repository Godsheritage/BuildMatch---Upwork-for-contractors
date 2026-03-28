import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { getMyContractorProfile } from '../../services/contractor.service';
import api from '../../services/api';
import { ReliabilityScoreBadge } from './ReliabilityScoreBadge';
import styles from './ContractorScorePanel.module.css';

// ── API type ──────────────────────────────────────────────────────────────────

interface ScoreDetails {
  totalScore:        number | null;
  responseRatePts:   number | null;
  onTimePts:         number | null;
  bidAccuracyPts:    number | null;
  jobCompletionPts:  number | null;
  disputeHistoryPts: number | null;
  explanation:       string;
  improvementTips:   string[];
  computedAt:        string | null;
}

async function getMyReliabilityScore(): Promise<ScoreDetails> {
  const res = await api.get<{ success: boolean; data: ScoreDetails }>('/ai/reliability/me');
  return res.data.data;
}

// ── Bar component ─────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  pts,
  max,
}: {
  label: string;
  pts:   number | null;
  max:   number;
}) {
  const value  = pts ?? 0;
  const pct    = Math.round((value / max) * 100);

  let barColor = '#0F6E56';
  if (pct < 40) barColor = '#DC2626';
  else if (pct < 60) barColor = '#B45309';
  else if (pct < 80) barColor = '#1D9E75';

  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span className={styles.barPts}>
        {pts !== null ? pts.toFixed(0) : '—'}<span className={styles.barMax}>/{max}</span>
      </span>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ContractorScorePanel() {
  const { user } = useAuth();

  // Fetch the profile just to check if it exists (ContractorScorePanel is only
  // rendered inside the contractor dashboard, so this query is already warm)
  const { data: profile } = useQuery({
    queryKey: ['contractor', 'me'],
    queryFn:  getMyContractorProfile,
    retry:    false,
    staleTime: 60_000,
  });

  const {
    data: score,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['reliability', 'me'],
    queryFn:  getMyReliabilityScore,
    enabled:  !!user,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Your Reliability Score</h2>
        </div>
        <div className={styles.skeletonWrap}>
          {[80, 60, 60, 60, 60].map((w, i) => (
            <div key={i} className={styles.skeleton} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return null; // non-critical — fail silently
  }

  const isNew = !score || score.totalScore === null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Your Reliability Score</h2>
        {score?.computedAt && (
          <span className={styles.updatedAt}>
            Updated {new Date(score.computedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {isNew ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyCircle}>—</div>
          <p className={styles.emptyText}>
            Your score will appear after your first completed job.
          </p>
          <div className={styles.tipsBlock}>
            <p className={styles.tipsHeading}>Tips to get started:</p>
            <ul className={styles.tipsList}>
              {(score?.improvementTips ?? []).map((tip, i) => (
                <li key={i} className={styles.tipItem}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <>
          {/* Score circle */}
          <div className={styles.scoreTop}>
            <ReliabilityScoreBadge score={score!.totalScore!} size="lg" />
          </div>

          {/* Breakdown bars */}
          <div className={styles.barsSection}>
            <ScoreBar label="Response Rate"      pts={score!.responseRatePts}   max={25} />
            <ScoreBar label="On-Time Completion"  pts={score!.onTimePts}          max={25} />
            <ScoreBar label="Bid Accuracy"        pts={score!.bidAccuracyPts}     max={20} />
            <ScoreBar label="Job Completion Rate" pts={score!.jobCompletionPts}   max={20} />
            <ScoreBar label="Dispute History"     pts={score!.disputeHistoryPts}  max={10} />
          </div>

          {/* AI explanation */}
          {score!.explanation && (
            <p className={styles.explanation}>{score!.explanation}</p>
          )}

          {/* Improvement tips */}
          {score!.improvementTips.length > 0 && (
            <div className={styles.tipsBlock}>
              <p className={styles.tipsHeading}>How to improve:</p>
              <ul className={styles.tipsList}>
                {score!.improvementTips.map((tip, i) => (
                  <li key={i} className={styles.tipItem}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <p className={styles.footer}>
        Score updated nightly · Based on your last 90 days of activity
      </p>
    </div>
  );
}
