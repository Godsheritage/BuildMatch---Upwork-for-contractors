import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, AlertTriangle, Sparkles, Printer,
  ChevronDown, ChevronUp, ArrowRight, Home, XCircle, HelpCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import api from '../../services/api';
import type { WizardState } from '../../pages/EstimatorPage';
import type { PropertyEstimate } from '../../services/property.service';

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  state:     WizardState;
  onUpdate:  (patch: Partial<WizardState>) => void;
  onGoToStep: (step: 1 | 2 | 3 | 4 | 5) => void;
}

// ── Progress messages ────────────────────────────────────────────────────────

const PROGRESS_MESSAGES = [
  'Reviewing living area photos…',
  'Analyzing kitchen and bathroom conditions…',
  'Assessing mechanical systems…',
  'Evaluating exterior and roof…',
  'Calculating regional construction costs…',
  'Generating room-by-room breakdown…',
  'Finalizing your estimate…',
];

// ── Line item / room types (from the AI result) ─────────────────────────────

interface LineItem {
  category: string; label: string; condition: string;
  scopeRecommended: string; amountLow: number; amountHigh: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'; evidenceFromPhotos: string;
}

interface RoomRow {
  roomName: string; condition: 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  issues: string[]; recommendedWork: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function Step5Results({ state, onUpdate, onGoToStep }: Props) {
  const navigate  = useNavigate();
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const [estimate, setEstimate]   = useState<PropertyEstimate | null>(null);
  const [msgIdx,   setMsgIdx]     = useState(0);

  const status = state.estimateStatus ?? 'PROCESSING';

  // ── Cycling progress messages ──────────────────────────────────────────

  useEffect(() => {
    if (status !== 'PROCESSING') return;
    const id = setInterval(() => setMsgIdx(i => (i + 1) % PROGRESS_MESSAGES.length), 3000);
    return () => clearInterval(id);
  }, [status]);

  // ── Polling ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!state.estimateId || status !== 'PROCESSING') return;

    const tick = async () => {
      try {
        const { data } = await api.get<{
          success: boolean;
          data: { status: string; totalLow?: number; totalHigh?: number; updatedAt?: string };
        }>(`/estimator/estimates/${state.estimateId}/poll`);
        const poll = data.data;
        if (poll.status === 'COMPLETE' || poll.status === 'FAILED') {
          if (pollRef.current) clearInterval(pollRef.current);
          onUpdate({ estimateStatus: poll.status as 'COMPLETE' | 'FAILED' });
          // Fetch full estimate
          if (poll.status === 'COMPLETE') {
            const full = await api.get<{ success: boolean; data: PropertyEstimate }>(
              `/estimator/estimates/${state.estimateId}`,
            );
            setEstimate(full.data.data);
          }
        }
      } catch { /* keep polling */ }
    };

    void tick();
    pollRef.current = setInterval(tick, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [state.estimateId, status, onUpdate]);

  // ── Processing state ───────────────────────────────────────────────────

  if (status === 'PROCESSING') {
    return (
      <div style={centerWrap}>
        <div style={pulseIcon}>
          <Home size={36} strokeWidth={1.5} color="var(--color-primary)" />
          <Sparkles size={16} strokeWidth={2} color="#7C3AED" style={{ position: 'absolute', top: -4, right: -4 }} />
        </div>

        <h2 style={{ margin: '24px 0 8px', fontSize: 22, fontWeight: 600 }}>Analyzing your property…</h2>
        <p style={progressMsg}>{PROGRESS_MESSAGES[msgIdx]}</p>

        {/* Progress bar — CSS-animated over 35s */}
        <div style={progressTrack}>
          <div style={progressFillAnim} />
        </div>

        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '12px 0 0' }}>
          Typically takes 15–40 seconds depending on photo count
        </p>

        <style>{`
          @keyframes fillBar { from { width: 0%; } to { width: 95%; } }
          @keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }
        `}</style>
      </div>
    );
  }

  // ── Failed state ───────────────────────────────────────────────────────

  if (status === 'FAILED') {
    return (
      <div style={centerWrap}>
        <XCircle size={48} strokeWidth={1.5} color="var(--color-danger)" />
        <h2 style={{ margin: '16px 0 8px', fontSize: 22, fontWeight: 600 }}>Analysis could not be completed</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 440, textAlign: 'center', lineHeight: 1.6, margin: '0 0 24px' }}>
          This can happen with very dark photos, blurry images, or connectivity issues.
          Try again with clearer photos or fewer images.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="primary" onClick={() => onGoToStep(2)}>Try Again</Button>
          <Button variant="secondary" onClick={() => window.open('mailto:support@buildmatch.us', '_blank')}>
            <HelpCircle size={14} /> Contact Support
          </Button>
        </div>
      </div>
    );
  }

  // ── Results state ──────────────────────────────────────────────────────

  if (!estimate) return null;

  const lineItems     = (estimate.line_items ?? []) as unknown as LineItem[];
  const roomBreakdown = (estimate.room_breakdown ?? []) as unknown as RoomRow[];
  const cannotAssess  = estimate.cannot_assess ?? [];
  const { property } = state;
  const sorted = [...lineItems].sort((a, b) => b.amountHigh - a.amountHigh);
  const sumLow  = lineItems.reduce((s, i) => s + i.amountLow,  0);
  const sumHigh = lineItems.reduce((s, i) => s + i.amountHigh, 0);

  return (
    <div className="estimate-results-printable">
      {/* ── Results header ──────────────────────────────────────────────── */}
      <div style={headerBanner}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle2 size={22} strokeWidth={2} color="#065F46" />
          <span style={{ fontSize: 18, fontWeight: 600, color: '#065F46' }}>Analysis Complete</span>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#065F46' }}>
          {property.addressLine1}, {property.city}, {property.state} {property.zipCode}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }} className="no-print">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={14} /> Print Report
          </Button>
          <Button variant="primary" size="sm"
            onClick={() => navigate(`/dashboard/post-job?estimateId=${state.estimateId}`)}>
            Post a Job <ArrowRight size={14} />
          </Button>
        </div>
      </div>

      {/* ── Total estimate card ─────────────────────────────────────────── */}
      <div style={totalCard}>
        <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--color-accent)', margin: 0, letterSpacing: '-0.02em' }}>
          ${(estimate.total_low ?? 0).toLocaleString()} – ${(estimate.total_high ?? 0).toLocaleString()}
        </p>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '4px 0 8px' }}>
          Estimated Total Renovation Cost
        </p>
        <ConfidenceBadge level={estimate.confidence_overall} />
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '12px 0 0' }}>
          Based on {estimate.photo_count} photos analyzed • Regional costs for {property.city}, {property.state}
        </p>
        {estimate.ai_summary && (
          <p style={{ fontSize: 14, color: 'var(--color-text-primary)', lineHeight: 1.7, margin: '16px 0 0', whiteSpace: 'pre-wrap' }}>
            {estimate.ai_summary}
          </p>
        )}
      </div>

      {/* ── Room-by-room breakdown ──────────────────────────────────────── */}
      {roomBreakdown.length > 0 && (
        <div style={section}>
          <h3 style={sectionTitle}>Room-by-Room Condition Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {roomBreakdown.map((room, i) => (
              <div key={i} style={{
                padding: '14px 0',
                borderBottom: i < roomBreakdown.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{room.roomName}</span>
                  <ConditionBadge condition={room.condition} />
                </div>
                {room.issues.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {room.issues.map((iss, j) => (
                      <span key={j} style={issuePill}>{iss}</span>
                    ))}
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  <strong>Recommended:</strong> {room.recommendedWork}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cost line items table ───────────────────────────────────────── */}
      {sorted.length > 0 && (
        <div style={section}>
          <h3 style={sectionTitle}>Estimated Costs by Category</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Category</th>
                  <th style={th}>Condition</th>
                  <th style={th}>Recommended Scope</th>
                  <th style={thRight}>Low</th>
                  <th style={thRight}>High</th>
                  <th style={{ ...th, textAlign: 'center' }}>Conf.</th>
                  <th style={th} className="no-print"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, i) => (
                  <LineItemRow key={i} item={item} />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--color-primary)' }}>
                  <td colSpan={3} style={{ ...td, fontWeight: 700, fontSize: 14, color: 'var(--color-primary)' }}>Total</td>
                  <td style={{ ...tdRight, fontWeight: 700, fontSize: 14, color: 'var(--color-primary)' }}>${sumLow.toLocaleString()}</td>
                  <td style={{ ...tdRight, fontWeight: 700, fontSize: 14, color: 'var(--color-primary)' }}>${sumHigh.toLocaleString()}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Cannot assess ───────────────────────────────────────────────── */}
      {cannotAssess.length > 0 && (
        <div style={amberBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={16} strokeWidth={2} color="#92400E" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#92400E' }}>
              Could not be assessed from photos alone
            </span>
          </div>
          <ul style={{ margin: '0 0 10px', paddingLeft: 20, fontSize: 13, color: '#78350F', lineHeight: 1.7 }}>
            {cannotAssess.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
          <p style={{ margin: 0, fontSize: 12, color: '#92400E', fontStyle: 'italic' }}>
            These items may significantly impact the final renovation cost.
            A professional inspection is recommended before making an offer.
          </p>
        </div>
      )}

      {/* ── Rationale ───────────────────────────────────────────────────── */}
      {estimate.ai_rationale && (
        <div style={section}>
          <h3 style={sectionTitle}>How We Estimated This</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
            {estimate.ai_rationale}
          </p>
        </div>
      )}

      {/* ── Post a Job CTA ──────────────────────────────────────────────── */}
      <div style={ctaCard} className="no-print">
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: '#fff' }}>
          Ready to find contractors for this property?
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
          Post a job using this estimate as your starting point. The property address,
          scope of work, and budget range will be pre-filled from this analysis.
        </p>
        <button
          type="button"
          onClick={() => navigate(`/dashboard/post-job?estimateId=${state.estimateId}`)}
          style={ctaBtn}
        >
          Post a Job from This Estimate <ArrowRight size={15} />
        </button>
      </div>

      {/* ── Print footer (only visible in print) ─────────────────────────── */}
      <div className="print-only" style={{ display: 'none' }}>
        <div style={{ borderTop: '1px solid #ccc', marginTop: 32, paddingTop: 12, fontSize: 10, color: '#999' }}>
          <p>BuildMatch Property Renovation Estimate • Generated {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
          <p>This estimate is for due diligence purposes only. Actual contractor bids may vary 20–40%. Always obtain at least 3 bids before committing.</p>
        </div>
      </div>

      {/* ── Print styles ──────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          nav, aside, header, footer, [class*="sidebar"], [class*="Sidebar"] { display: none !important; }
          body { background: white !important; }
          .estimate-results-printable { max-width: 100% !important; padding: 0 !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const colors: Record<string, { bg: string; fg: string }> = {
    HIGH:   { bg: '#D1FAE5', fg: '#065F46' },
    MEDIUM: { bg: '#FEF3C7', fg: '#92400E' },
    LOW:    { bg: '#FEE2E2', fg: '#991B1B' },
  };
  const c = colors[level] ?? colors.MEDIUM;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 10, background: c.bg, color: c.fg }}>
      {level === 'HIGH' ? <CheckCircle2 size={12} /> : level === 'LOW' ? <AlertTriangle size={12} /> : null}
      {level} Confidence
    </span>
  );
}

function ConditionBadge({ condition }: { condition: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    GOOD:     { bg: '#D1FAE5', fg: '#065F46' },
    FAIR:     { bg: '#DBEAFE', fg: '#1E40AF' },
    POOR:     { bg: '#FEF3C7', fg: '#92400E' },
    CRITICAL: { bg: '#FEE2E2', fg: '#991B1B' },
  };
  const c = colors[condition] ?? colors.FAIR;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: c.bg, color: c.fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>
      {condition}
    </span>
  );
}

function ConfidenceDot({ level }: { level: string }) {
  const color = level === 'HIGH' ? '#059669' : level === 'MEDIUM' ? '#D97706' : '#DC2626';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 11, color }}>{level}</span>
    </span>
  );
}

function LineItemRow({ item }: { item: LineItem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
        <td style={td}>{item.category}</td>
        <td style={td}>{item.condition}</td>
        <td style={{ ...td, maxWidth: 200 }}>{item.scopeRecommended}</td>
        <td style={tdRight}>${item.amountLow.toLocaleString()}</td>
        <td style={tdRight}>${item.amountHigh.toLocaleString()}</td>
        <td style={{ ...td, textAlign: 'center' }}><ConfidenceDot level={item.confidence} /></td>
        <td style={td} className="no-print">
          {item.evidenceFromPhotos && (
            <button type="button" onClick={() => setExpanded(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </td>
      </tr>
      {expanded && item.evidenceFromPhotos && (
        <tr>
          <td colSpan={7} style={{ padding: '8px 14px', fontSize: 12, color: 'var(--color-text-muted)', background: '#FAFAF9', lineHeight: 1.6 }}>
            <strong>Evidence from photos:</strong> {item.evidenceFromPhotos}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const centerWrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', textAlign: 'center', padding: '60px 20px', minHeight: 400,
};

const pulseIcon: React.CSSProperties = {
  position: 'relative', width: 72, height: 72, borderRadius: '50%',
  background: 'rgba(27, 58, 92, 0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: 'pulse 2s ease-in-out infinite',
};

const progressMsg: React.CSSProperties = {
  fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 20px',
  minHeight: 20, transition: 'opacity 0.3s',
};

const progressTrack: React.CSSProperties = {
  width: '100%', maxWidth: 360, height: 6, borderRadius: 3,
  background: '#E5E7EB', overflow: 'hidden',
};

const progressFillAnim: React.CSSProperties = {
  height: '100%', borderRadius: 3, background: 'var(--color-accent)',
  animation: 'fillBar 35s ease-out forwards',
};

const headerBanner: React.CSSProperties = {
  padding: '20px 24px', marginBottom: 20, borderRadius: 12,
  background: '#ECFDF5', border: '1px solid #A7F3D0',
};

const totalCard: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--color-border)',
  borderRadius: 12, padding: '28px 24px', marginBottom: 20, textAlign: 'center',
};

const section: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--color-border)',
  borderRadius: 12, padding: '20px 22px', marginBottom: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 600, margin: '0 0 16px', letterSpacing: '-0.01em',
};

const issuePill: React.CSSProperties = {
  display: 'inline-block', fontSize: 11, fontWeight: 500,
  padding: '2px 8px', borderRadius: 6,
  background: '#F3F4F6', color: '#374151',
};

const table: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: 13,
};

const th: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px', fontSize: 11,
  textTransform: 'uppercase', letterSpacing: 0.4,
  color: 'var(--color-text-muted)', fontWeight: 600,
  borderBottom: '1px solid var(--color-border)',
};
const thRight: React.CSSProperties = { ...th, textAlign: 'right' };

const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

const amberBox: React.CSSProperties = {
  padding: '18px 20px', marginBottom: 20, borderRadius: 12,
  background: '#FFFBEB', border: '1px solid #FDE68A',
};

const ctaCard: React.CSSProperties = {
  padding: '28px 24px', marginBottom: 20, borderRadius: 12,
  background: 'linear-gradient(135deg, #0F6E56 0%, #1B3A5C 100%)',
};

const ctaBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '14px 24px', borderRadius: 10,
  background: '#fff', color: 'var(--color-primary)',
  border: 'none', fontSize: 15, fontWeight: 600,
  cursor: 'pointer',
};
