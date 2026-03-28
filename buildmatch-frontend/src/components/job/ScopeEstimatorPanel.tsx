import { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
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
  'Detecting scope...',
  'Estimating materials...',
  'Calculating costs...',
];

// ── Internal UI components ─────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: 'low' | 'medium' | 'high' }) {
  const configs = {
    high:   { bg: '#DCFCE7', color: '#166534', label: 'High confidence' },
    medium: { bg: '#FEF9C3', color: '#854D0E', label: 'Medium confidence' },
    low:    { bg: '#F3F4F6', color: '#374151', label: 'Low confidence' },
  } as const;
  const c = configs[confidence];
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 500,
        padding: '2px 8px', borderRadius: 'var(--radius-pill)',
        background: c.bg, color: c.color,
      }}
    >
      {c.label}
    </span>
  );
}

function ComplexityBadge({ level }: { level: 'light' | 'moderate' | 'heavy' }) {
  const configs = {
    light:    { bg: '#DCFCE7', color: '#166534' },
    moderate: { bg: '#FEF9C3', color: '#854D0E' },
    heavy:    { bg: '#FEE2E2', color: '#991B1B' },
  } as const;
  const c = configs[level];
  return (
    <span
      style={{
        display: 'inline-block', fontSize: 12, fontWeight: 500,
        padding: '3px 10px', borderRadius: 'var(--radius-pill)',
        background: c.bg, color: c.color,
        textTransform: 'capitalize',
      }}
    >
      {level}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type PanelStatus = 'idle' | 'loading' | 'done' | 'lowconf';

export function ScopeEstimatorPanel({
  photoUrls,
  tradeType,
  city,
  state,
  onEstimateReceived,
  onApplyBudget,
}: ScopeEstimatorPanelProps) {
  const [status, setStatus]       = useState<PanelStatus>('idle');
  const [estimate, setEstimate]   = useState<ScopeEstimate | null>(null);
  const [progressIdx, setProgressIdx] = useState(0);

  // ── Reset panel when key inputs change after an estimate has been shown ──
  const prevKeyRef = useRef(`${photoUrls.join(',')}|${tradeType}|${city}|${state}`);

  useEffect(() => {
    const curr = `${photoUrls.join(',')}|${tradeType}|${city}|${state}`;
    if (curr !== prevKeyRef.current) {
      prevKeyRef.current = curr;
      if (status !== 'idle') {
        setStatus('idle');
        setEstimate(null);
      }
    }
  }, [photoUrls, tradeType, city, state, status]);

  // ── Progress text cycling while loading ─────────────────────────────────
  useEffect(() => {
    if (status !== 'loading') return;
    setProgressIdx(0);
    const interval = setInterval(
      () => setProgressIdx((i) => (i + 1) % PROGRESS_TEXTS.length),
      2000,
    );
    return () => clearInterval(interval);
  }, [status]);

  // ── API call ─────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    setStatus('loading');
    try {
      const res = await api.post<{ success: boolean; data: ScopeEstimate }>(
        '/ai/scope-estimate',
        { photoUrls, tradeType, city, state },
      );
      const est = res.data.data;

      if (est.confidence === 'low' && est.budgetRangeLow === 0) {
        setStatus('lowconf');
        setEstimate(est);
      } else {
        setStatus('done');
        setEstimate(est);
        onEstimateReceived(est);
      }
    } catch {
      setStatus('lowconf');
      setEstimate(null);
    }
  }

  function handleReanalyze() {
    setStatus('idle');
    setEstimate(null);
  }

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (status === 'idle') {
    return (
      <div className={styles.idleCard}>
        <Sparkles size={16} color="var(--color-primary)" strokeWidth={1.75} style={{ flexShrink: 0 }} />
        <p className={styles.idleText}>
          Let AI analyze your photos to estimate scope
        </p>
        <Button type="button" variant="primary" size="sm" onClick={handleAnalyze}>
          Analyze Photos
        </Button>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className={styles.loadingCard}>
        <div className={styles.sparkleWrap}>
          <Sparkles size={20} color="var(--color-primary)" strokeWidth={1.75} className={styles.sparkle} />
        </div>
        <p className={styles.loadingTitle}>Analyzing your photos…</p>
        <p className={styles.loadingProgress}>{PROGRESS_TEXTS[progressIdx]}</p>
      </div>
    );
  }

  // ── LOW CONFIDENCE / ERROR ────────────────────────────────────────────────
  if (status === 'lowconf') {
    return (
      <div className={styles.lowconfCard}>
        <p className={styles.lowconfText}>
          Photo analysis returned low confidence results. Try uploading clearer photos or fill in the details manually.
        </p>
        <button type="button" className={styles.reanalyzeLink} onClick={handleReanalyze}>
          Try again
        </button>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (!estimate) return null;

  return (
    <div className={styles.resultCard}>
      {/* Header */}
      <div className={styles.resultHeader}>
        <div className={styles.resultHeaderLeft}>
          <Sparkles size={14} color="#7C3AED" strokeWidth={1.75} />
          <span className={styles.resultTitle}>AI Scope Estimate</span>
        </div>
        <ConfidenceBadge confidence={estimate.confidence} />
      </div>

      {/* Project type */}
      <p className={styles.projectType}>{estimate.projectType}</p>

      {/* Budget block */}
      <div className={styles.budgetBlock}>
        <p className={styles.budgetRange}>
          ${estimate.budgetRangeLow.toLocaleString()} – ${estimate.budgetRangeHigh.toLocaleString()}
        </p>
        <p className={styles.budgetLabel}>
          Estimated budget range for {city}, {state}
        </p>
        {onApplyBudget && (
          <button
            type="button"
            className={styles.applyBtn}
            onClick={() => onApplyBudget(estimate.budgetRangeLow, estimate.budgetRangeHigh)}
          >
            Apply to my job
          </button>
        )}
      </div>

      {/* Scope items */}
      {estimate.scopeItems.length > 0 && (
        <div className={styles.listSection}>
          <p className={styles.listLabel}>Work Detected</p>
          <ul className={styles.bulletList}>
            {estimate.scopeItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {/* Materials */}
      {estimate.materialsLikely.length > 0 && (
        <div className={styles.listSection}>
          <p className={styles.listLabel}>Materials Likely Needed</p>
          <ul className={styles.bulletList}>
            {estimate.materialsLikely.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {/* Complexity + Duration */}
      <div className={styles.metaRow}>
        <div>
          <p className={styles.listLabel}>Complexity</p>
          <ComplexityBadge level={estimate.complexityLevel} />
        </div>
        <div>
          <p className={styles.listLabel}>Estimated Duration</p>
          <p className={styles.durationText}>{estimate.estimatedDuration}</p>
        </div>
      </div>

      {/* Caveat */}
      <p className={styles.caveat}>
        {estimate.caveat} · This estimate is AI-generated from visible photo conditions.
        Actual costs may vary. Always get multiple contractor bids.
      </p>

      {/* Re-analyze */}
      <button type="button" className={styles.reanalyzeLink} onClick={handleReanalyze}>
        Re-analyze
      </button>
    </div>
  );
}
