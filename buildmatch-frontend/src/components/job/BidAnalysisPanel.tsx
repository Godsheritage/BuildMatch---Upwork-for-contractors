import React, { Component } from 'react';
import { Sparkles, RefreshCw, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '../ui/Spinner';
import { StarRating } from '../ui/StarRating';
import api from '../../services/api';
import styles from './BidAnalysisPanel.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BidComparison {
  contractorId:    string;
  amountVsBudget:  'within' | 'above' | 'below';
  amountDeltaPct:  number;
  qualitySignal:   'strong' | 'moderate' | 'limited';
  noteForInvestor: string;
}

interface BidAnalysis {
  summary:        string;
  budgetContext:  string;
  topPickId:      string | null;
  topPickReason:  string;
  redFlagIds:     string[];
  redFlags:       { contractorId: string; concern: string }[];
  insights:       string[];
  bidComparisons: BidComparison[];
}

interface ApiResponse<T> {
  success: boolean;
  data:    T;
  message?: string;
}

// ── API fetch ─────────────────────────────────────────────────────────────────

async function fetchBidAnalysis(jobId: string): Promise<BidAnalysis> {
  const { data: res } = await api.get<ApiResponse<BidAnalysis>>(`/ai/bids/${jobId}/analysis`);
  return res.data;
}

// ── Error boundary ────────────────────────────────────────────────────────────

interface EBState { hasError: boolean }

export class BidAnalysisPanelErrorBoundary extends Component<
  { children: React.ReactNode },
  EBState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch(err: Error) {
    console.error('[BidAnalysisPanel] caught error:', err);
  }

  render() {
    if (this.state.hasError) return null; // silently hide; never break bids section
    return this.props.children;
  }
}

// ── Budget badge ──────────────────────────────────────────────────────────────

function BudgetBadge({ tier, deltaPct }: { tier: BidComparison['amountVsBudget']; deltaPct: number }) {
  if (tier === 'within') return <span className={`${styles.badge} ${styles.badgeWithin}`}>Within budget</span>;
  if (tier === 'above')  return <span className={`${styles.badge} ${styles.badgeAbove}`}>Above budget +{Math.abs(deltaPct).toFixed(0)}%</span>;
  return <span className={`${styles.badge} ${styles.badgeBelow}`}>Below budget</span>;
}

function QualityBadge({ signal }: { signal: BidComparison['qualitySignal'] }) {
  if (signal === 'strong')   return <span className={`${styles.badge} ${styles.badgeStrong}`}>Strong</span>;
  if (signal === 'moderate') return <span className={`${styles.badge} ${styles.badgeModerate}`}>Moderate</span>;
  return <span className={`${styles.badge} ${styles.badgeLimited}`}>Limited</span>;
}

// ── Inner panel (receives analysis data) ─────────────────────────────────────

interface InnerProps {
  analysis:    BidAnalysis;
  generatedAt: string;
  onRefresh:   () => void;
  isRefreshing: boolean;
  onCollapse:  () => void;
  // bid data for enriching the comparison table
  bids: { contractorProfileId: string; firstName: string; lastName: string; completedJobs: number; averageRating: number; amount: number }[];
}

function AnalysisContent({ analysis, generatedAt, onRefresh, isRefreshing, onCollapse, bids }: InnerProps) {
  const bidByProfileId = new Map(bids.map((b) => [b.contractorProfileId, b]));

  // Top pick contractor enrichment
  const topPick = analysis.topPickId ? bidByProfileId.get(analysis.topPickId) : null;

  // Sort comparisons by amount ASC
  const sortedComparisons = [...analysis.bidComparisons].sort((a, b) => {
    const amtA = bidByProfileId.get(a.contractorId)?.amount ?? 0;
    const amtB = bidByProfileId.get(b.contractorId)?.amount ?? 0;
    return amtA - amtB;
  });

  const ts = new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderLeft}>
          <Sparkles size={15} className={styles.sparkle} />
          AI Bid Analysis
        </div>
        <div className={styles.cardHeaderRight}>
          <span className={styles.timestamp}>Updated {ts}</span>
          <button className={styles.refreshBtn} onClick={onRefresh} disabled={isRefreshing} type="button">
            <RefreshCw size={12} strokeWidth={2.5} />
            Refresh
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* Summary */}
        <div>
          <p className={styles.sectionLabel}>Summary</p>
          <p className={styles.summaryText}>{analysis.summary}</p>
          {analysis.budgetContext && (
            <div className={styles.budgetCallout}>{analysis.budgetContext}</div>
          )}
        </div>

        {/* Top pick */}
        {analysis.topPickId && (
          <div className={styles.topPickCallout}>
            <div className={styles.topPickHeader}>
              <span>✓</span> Recommended Pick
            </div>
            {topPick && (
              <>
                <p className={styles.topPickName}>{topPick.firstName} {topPick.lastName}</p>
                <div className={styles.topPickStats}>
                  <StarRating rating={topPick.averageRating} size={11} />
                  <span>{topPick.completedJobs} jobs completed</span>
                </div>
              </>
            )}
            {analysis.topPickReason && (
              <p className={styles.topPickReason}>{analysis.topPickReason}</p>
            )}
          </div>
        )}

        {/* Red flags */}
        {analysis.redFlags.length > 0 && (
          <div className={styles.redFlagsCallout}>
            <div className={styles.redFlagsHeader}>
              <span>⚠</span> Points to consider
            </div>
            {analysis.redFlags.map((rf, i) => {
              const contractor = bidByProfileId.get(rf.contractorId);
              const label = contractor ? `${contractor.firstName} ${contractor.lastName[0]}.` : rf.contractorId.slice(-4);
              return (
                <p key={i} className={styles.redFlagItem}>
                  <strong>{label}:</strong> {rf.concern}
                </p>
              );
            })}
          </div>
        )}

        {/* Bid comparison table */}
        {sortedComparisons.length > 0 && (
          <div>
            <p className={styles.sectionLabel}>Bid Comparison</p>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th>Contractor</th>
                  <th>Amount</th>
                  <th>vs Budget</th>
                  <th>Quality</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {sortedComparisons.map((c) => {
                  const contractor = bidByProfileId.get(c.contractorId);
                  const initials = contractor
                    ? `${contractor.firstName[0] ?? ''}${contractor.lastName[0] ?? ''}`.toUpperCase()
                    : '?';
                  const amount = contractor?.amount;
                  return (
                    <tr key={c.contractorId} className={styles.tableRow}>
                      <td>
                        <div className={styles.contractorInitials}>{initials}</div>
                      </td>
                      <td>
                        <span className={styles.amount}>
                          {amount != null ? `$${amount.toLocaleString()}` : '—'}
                        </span>
                      </td>
                      <td><BudgetBadge tier={c.amountVsBudget} deltaPct={c.amountDeltaPct} /></td>
                      <td><QualityBadge signal={c.qualitySignal} /></td>
                      <td><span className={styles.noteText}>{c.noteForInvestor}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Insights */}
        {analysis.insights.length > 0 && (
          <div>
            <p className={styles.sectionLabel}>Key Insights</p>
            <ul className={styles.insightsList}>
              {analysis.insights.map((ins, i) => (
                <li key={i} className={styles.insightItem}>
                  <span className={styles.insightDot} />
                  {ins}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Disclaimer */}
        <p className={styles.disclaimer}>
          AI analysis is informational only. Always review contractor profiles and exercise your own judgment before hiring.
        </p>

        {/* Collapse */}
        <div className={styles.collapseRow}>
          <button className={styles.collapseBtn} onClick={onCollapse} type="button">
            <ChevronUp size={13} strokeWidth={2} />
            Collapse
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface BidForPanel {
  contractorProfileId: string;
  firstName:           string;
  lastName:            string;
  completedJobs:       number;
  averageRating:       number;
  amount:              number;
}

interface Props {
  jobId:    string;
  bidCount: number;
  bids?:    BidForPanel[];
}

export function BidAnalysisPanel({ jobId, bidCount, bids = [] }: Props) {
  const [expanded, setExpanded]     = React.useState(false);
  const [fetchEnabled, setFetchEnabled] = React.useState(false);

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey:  ['bid-analysis', jobId],
    queryFn:   () => fetchBidAnalysis(jobId),
    enabled:   fetchEnabled,
    staleTime: 10 * 60 * 1000, // 10 min — matches server cache TTL
    retry:     false,
  });

  if (bidCount < 2) return null;

  function handleViewAnalysis() {
    setExpanded(true);
    setFetchEnabled(true);
  }

  function handleCollapse() {
    setExpanded(false);
  }

  function handleRefresh() {
    refetch();
  }

  // Collapsed bar
  if (!expanded) {
    return (
      <div className={styles.collapsedBar}>
        <div className={styles.collapsedLeft}>
          <Sparkles size={14} className={styles.sparkle} />
          AI Bid Analysis available
        </div>
        <button className={styles.viewBtn} onClick={handleViewAnalysis} type="button">
          View Analysis
        </button>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className={styles.loadingRow}>
        <Spinner size="sm" />
        Analyzing {bidCount} bids…
      </div>
    );
  }

  // Error
  if (isError || !data) {
    return (
      <div className={styles.collapsedBar}>
        <div className={styles.collapsedLeft}>
          <Sparkles size={14} className={styles.sparkle} />
          Analysis temporarily unavailable
        </div>
        <button className={styles.viewBtn} onClick={handleRefresh} type="button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <AnalysisContent
      analysis={data}
      generatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : new Date().toISOString()}
      onRefresh={handleRefresh}
      isRefreshing={isLoading}
      onCollapse={handleCollapse}
      bids={bids}
    />
  );
}
