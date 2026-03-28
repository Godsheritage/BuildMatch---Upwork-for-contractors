import { useState, useEffect, useRef } from 'react';
import { Sparkles, Check, Clock, Layers, RotateCcw, Square } from 'lucide-react';
import { Button } from '../ui/Button';
import api from '../../services/api';
import styles from './ScopeEstimatorPanel.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScopeEstimate {
  projectType:       string;
  estimatedSqFt:     number | null;
  budgetRangeLow:    number;
  budgetRangeHigh:   number;
  scopeItems:        string[];
  materialsLikely:   string[];
  complexityLevel:   'light' | 'moderate' | 'heavy';
  estimatedDuration: string;
  confidence:        'low' | 'medium' | 'high';
  caveat:            string;
}

interface ScopeEstimatorPanelProps {
  photoUrls:          string[];
  tradeType:          string;
  city:               string;
  state:              string;
  onEstimateReceived: (estimate: ScopeEstimate) => void;
  onApplyBudget?:     (low: number, high: number) => void;
}

// ── Loading progress texts ─────────────────────────────────────────────────────

const PROGRESS_TEXTS = [
  'Analyzing photo composition…',
  'Detecting visible work scope…',
  'Estimating materials needed…',
  'Calculating local cost ranges…',
  'Finalizing estimate…',
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: 'low' | 'medium' | 'high' }) {
  const map = {
    high:   { bg: '#DCFCE7', color: '#166534', dot: '#22C55E', label: 'High confidence' },
    medium: { bg: '#FEF9C3', color: '#854D0E', dot: '#EAB308', label: 'Medium confidence' },
    low:    { bg: '#F3F4F6', color: '#374151', dot: '#9CA3AF', label: 'Low confidence' },
  } as const;
  const c = map[confidence];
  return (
    <span className={styles.confidenceBadge} style={{ background: c.bg, color: c.color }}>
      <span className={styles.confidenceDot} style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}

function MetricPill({
  children,
  variant = 'neutral',
}: {
  children: React.ReactNode;
  variant?: 'green' | 'amber' | 'red' | 'neutral';
}) {
  const colors = {
    green:   { bg: 'rgba(220,252,231,0.6)', color: '#166534' },
    amber:   { bg: 'rgba(254,249,195,0.6)', color: '#854D0E' },
    red:     { bg: 'rgba(254,226,226,0.6)', color: '#991B1B' },
    neutral: { bg: 'var(--color-surface)',   color: 'var(--color-text-muted)' },
  } as const;
  const c = colors[variant];
  return (
    <span className={styles.metricPill} style={{ background: c.bg, color: c.color }}>
      {children}
    </span>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

type PanelStatus = 'idle' | 'loading' | 'done' | 'lowconf';

export function ScopeEstimatorPanel({
  photoUrls,
  tradeType,
  city,
  state,
  onEstimateReceived,
  onApplyBudget,
}: ScopeEstimatorPanelProps) {
  const [status,      setStatus]      = useState<PanelStatus>('idle');
  const [estimate,    setEstimate]    = useState<ScopeEstimate | null>(null);
  const [progressIdx, setProgressIdx] = useState(0);
  const [progress,    setProgress]    = useState(0);

  // ── Reset when key inputs change ──────────────────────────────────────────
  const prevKeyRef = useRef(`${photoUrls.join(',')}|${tradeType}|${city}|${state}`);
  useEffect(() => {
    const curr = `${photoUrls.join(',')}|${tradeType}|${city}|${state}`;
    if (curr !== prevKeyRef.current) {
      prevKeyRef.current = curr;
      if (status !== 'idle') {
        setStatus('idle');
        setEstimate(null);
        setProgress(0);
      }
    }
  }, [photoUrls, tradeType, city, state, status]);

  // ── Cycle loading text ────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'loading') return;
    setProgressIdx(0);
    const interval = setInterval(
      () => setProgressIdx((i) => (i + 1) % PROGRESS_TEXTS.length),
      2200,
    );
    return () => clearInterval(interval);
  }, [status]);

  // ── Animate progress bar ──────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'loading') { setProgress(0); return; }
    setProgress(6);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 88) { clearInterval(interval); return p; }
        const inc = p < 40 ? 4 : p < 65 ? 2 : p < 80 ? 0.8 : 0.3;
        return Math.min(p + inc, 88);
      });
    }, 300);
    return () => clearInterval(interval);
  }, [status]);

  // ── API call ──────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    setStatus('loading');
    try {
      const res = await api.post<{ success: boolean; data: ScopeEstimate }>(
        '/ai/scope-estimate',
        { photoUrls, tradeType, city, state },
      );
      const est = res.data.data;
      setEstimate(est);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 250));

      if (est.confidence === 'low' && est.budgetRangeLow === 0) {
        setStatus('lowconf');
      } else {
        setStatus('done');
        onEstimateReceived(est);
      }
    } catch {
      setStatus('lowconf');
      setEstimate(null);
    }
  }

  function handleReset() {
    setStatus('idle');
    setEstimate(null);
    setProgress(0);
  }

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (status === 'idle') {
    const tradeLabel = tradeType.charAt(0) + tradeType.slice(1).toLowerCase();
    return (
      <div className={styles.idleCard}>
        <div className={styles.idleOrb}>
          <Sparkles size={22} color="#7C3AED" strokeWidth={1.75} />
        </div>

        <div className={styles.idleText}>
          <p className={styles.idleTitle}>Ready to analyze</p>
          <p className={styles.idleSubtitle}>
            AI will scan your {photoUrls.length} photo{photoUrls.length !== 1 ? 's' : ''} and
            return a detailed scope estimate for{' '}
            <strong>{tradeLabel}</strong> work in{' '}
            <strong>{city}, {state}</strong>.
          </p>
        </div>

        <ul className={styles.featureList}>
          {[
            'Budget range calibrated to your city',
            'Work scope detected from photos',
            'Materials likely needed',
            'Complexity level & duration',
          ].map((f) => (
            <li key={f} className={styles.featureItem}>
              <Check size={11} strokeWidth={2.5} color="#0F6E56" style={{ flexShrink: 0 }} />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleAnalyze}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Analyze {photoUrls.length} Photo{photoUrls.length !== 1 ? 's' : ''}
        </Button>

        <p className={styles.idleDisclosure}>
          Estimate typically returns in 10–20 seconds
        </p>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className={styles.loadingCard}>
        <div className={styles.loadingOrb}>
          <Sparkles size={24} color="#7C3AED" strokeWidth={1.75} className={styles.sparkle} />
        </div>
        <p className={styles.loadingTitle}>Analyzing your photos…</p>

        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={styles.progressPct}>{Math.round(progress)}%</span>
        </div>

        <p className={styles.loadingStep}>{PROGRESS_TEXTS[progressIdx]}</p>
      </div>
    );
  }

  // ── LOW CONFIDENCE / ERROR ────────────────────────────────────────────────
  if (status === 'lowconf') {
    return (
      <div className={styles.lowconfCard}>
        <div className={styles.lowconfIcon}>
          <Square size={16} fill="#B45309" color="#B45309" strokeWidth={0} />
        </div>
        <p className={styles.lowconfTitle}>Low confidence result</p>
        <p className={styles.lowconfText}>
          The photos didn't contain enough visual detail for a reliable estimate.
          Try uploading clearer, well-lit photos of the work area.
        </p>
        <button type="button" className={styles.resetBtn} onClick={handleReset}>
          <RotateCcw size={12} strokeWidth={2} />
          Try again
        </button>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (!estimate) return null;

  const complexityVariant: 'green' | 'amber' | 'red' =
    estimate.complexityLevel === 'light'  ? 'green'
    : estimate.complexityLevel === 'moderate' ? 'amber'
    : 'red';

  return (
    <div className={styles.resultCard}>

      {/* Top row */}
      <div className={styles.resultTopRow}>
        <div className={styles.resultAiBadge}>
          <Sparkles size={11} color="#7C3AED" strokeWidth={1.75} />
          <span>AI Estimate</span>
        </div>
        <ConfidenceBadge confidence={estimate.confidence} />
      </div>

      {/* Project type */}
      <h2 className={styles.projectType}>{estimate.projectType}</h2>

      {/* Budget block */}
      <div className={styles.budgetBlock}>
        <p className={styles.budgetLabel}>Estimated budget range</p>
        <p className={styles.budgetRange}>
          ${estimate.budgetRangeLow.toLocaleString()}
          <span className={styles.budgetDash}> – </span>
          ${estimate.budgetRangeHigh.toLocaleString()}
        </p>
        <p className={styles.budgetLocation}>{city}, {state}</p>
        {onApplyBudget && (
          <button
            type="button"
            className={styles.applyBtn}
            onClick={() => onApplyBudget(estimate.budgetRangeLow, estimate.budgetRangeHigh)}
          >
            Apply to my job →
          </button>
        )}
      </div>

      {/* Metric chips */}
      <div className={styles.metricsRow}>
        <MetricPill variant={complexityVariant}>
          <Layers size={11} strokeWidth={2} />
          {estimate.complexityLevel.charAt(0).toUpperCase() + estimate.complexityLevel.slice(1)} complexity
        </MetricPill>
        <MetricPill variant="neutral">
          <Clock size={11} strokeWidth={2} />
          {estimate.estimatedDuration}
        </MetricPill>
        {estimate.estimatedSqFt != null && (
          <MetricPill variant="neutral">
            ~{estimate.estimatedSqFt.toLocaleString()} sq ft
          </MetricPill>
        )}
      </div>

      <div className={styles.resultDivider} />

      {/* Scope items */}
      {estimate.scopeItems.length > 0 && (
        <div className={styles.listSection}>
          <p className={styles.listHeading}>Work Detected</p>
          <ul className={styles.dotList}>
            {estimate.scopeItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {/* Materials */}
      {estimate.materialsLikely.length > 0 && (
        <div className={styles.listSection}>
          <p className={styles.listHeading}>Materials Likely Needed</p>
          <ul className={styles.dotList}>
            {estimate.materialsLikely.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      <div className={styles.resultDivider} />

      {/* Footer */}
      <div className={styles.resultFooter}>
        <p className={styles.caveat}>
          {estimate.caveat} AI-generated estimate from visible photo conditions — actual costs may vary. Always get contractor bids.
        </p>
        <button type="button" className={styles.resetBtn} onClick={handleReset}>
          <RotateCcw size={11} strokeWidth={2} />
          Re-analyze
        </button>
      </div>

    </div>
  );
}
