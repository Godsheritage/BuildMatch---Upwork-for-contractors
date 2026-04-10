import { useEffect, useRef, useState } from 'react';
import {
  Loader, CheckCircle2, AlertTriangle, Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { getEstimate, type PropertyEstimate } from '../../services/property.service';
import type { WizardState } from '../../pages/EstimatorPage';

interface Props {
  wizard:         WizardState;
  onUpdate:       (patch: Partial<WizardState>) => void;
  onNewEstimate:  () => void;
}

export function EstimatorStep5Results({ wizard, onUpdate, onNewEstimate }: Props) {
  const [estimate, setEstimate] = useState<PropertyEstimate | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const status = wizard.estimateStatus ?? 'PROCESSING';

  // Poll while processing
  useEffect(() => {
    if (!wizard.estimateId || status !== 'PROCESSING') return;

    const tick = async () => {
      try {
        const est = await getEstimate(wizard.estimateId!);
        if (est.status === 'COMPLETE' || est.status === 'FAILED') {
          if (pollRef.current) clearInterval(pollRef.current);
          setEstimate(est);
          onUpdate({ estimateStatus: est.status as 'COMPLETE' | 'FAILED' });
        }
      } catch { /* keep polling */ }
    };

    void tick();
    pollRef.current = setInterval(tick, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [wizard.estimateId, status, onUpdate]);

  // ── Processing state ───────────────────────────────────────────────────

  if (status === 'PROCESSING') {
    return (
      <div style={centerStyle}>
        <Loader size={40} strokeWidth={1.5} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <h2 style={{ margin: '20px 0 8px', fontSize: 20, fontWeight: 600 }}>Analyzing your property…</h2>
        <p style={mutedText}>
          Claude is reviewing your photos and generating a detailed renovation cost breakdown.
          This usually takes 30–60 seconds.
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Failed state ───────────────────────────────────────────────────────

  if (status === 'FAILED') {
    return (
      <div style={centerStyle}>
        <AlertTriangle size={40} color="var(--color-danger)" strokeWidth={1.5} />
        <h2 style={{ margin: '16px 0 8px', fontSize: 20, fontWeight: 600 }}>Estimation failed</h2>
        <p style={mutedText}>{estimate?.ai_summary || 'Please try again with clearer photos.'}</p>
        <Button variant="primary" size="sm" onClick={onNewEstimate} style={{ marginTop: 16 }}>
          Try again
        </Button>
      </div>
    );
  }

  // ── Complete state ─────────────────────────────────────────────────────

  if (!estimate) return null;

  const lineItems     = (estimate.line_items ?? []) as unknown as Array<{ category: string; label: string; condition: string; scopeRecommended: string; amountLow: number; amountHigh: number; confidence: string; evidenceFromPhotos: string }>;
  const roomBreakdown = (estimate.room_breakdown ?? []) as unknown as Array<{ roomName: string; condition: string; issues: string[]; recommendedWork: string }>;
  const cannotAssess  = estimate.cannot_assess ?? [];

  return (
    <div>
      {/* Header card */}
      <div style={{ ...card, padding: 28, background: '#F0FDF4', borderColor: '#BBF7D0', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <CheckCircle2 size={22} color="var(--color-accent)" strokeWidth={2} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>Estimate complete</span>
          {estimate.confidence_overall && (
            <span style={confBadge}>{estimate.confidence_overall} confidence</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 32, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
          ${(estimate.total_low ?? 0).toLocaleString()} – ${(estimate.total_high ?? 0).toLocaleString()}
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Estimated renovation cost range
        </p>
      </div>

      {/* AI summary */}
      {estimate.ai_summary && (
        <div style={{ ...card, marginBottom: 16 }}>
          <p style={sectionTitle}><Sparkles size={14} strokeWidth={2} style={{ marginRight: 6 }} /> AI Summary</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
            {estimate.ai_summary}
          </p>
        </div>
      )}

      {/* Line items table */}
      {lineItems.length > 0 && (
        <div style={{ ...card, marginBottom: 16, padding: 0, overflow: 'auto' }}>
          <p style={{ ...sectionTitle, padding: '16px 20px 0' }}>Line items</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={th}>Category</th>
                <th style={th}>Item</th>
                <th style={th}>Condition</th>
                <th style={{ ...th, textAlign: 'right' }}>Low</th>
                <th style={{ ...th, textAlign: 'right' }}>High</th>
                <th style={th}>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={td}>{item.category}</td>
                  <td style={td}>{item.label}</td>
                  <td style={td}>{item.condition}</td>
                  <td style={{ ...td, textAlign: 'right' }}>${item.amountLow.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: 'right' }}>${item.amountHigh.toLocaleString()}</td>
                  <td style={td}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6,
                      background: item.confidence === 'HIGH' ? '#D1FAE5' : item.confidence === 'MEDIUM' ? '#FEF3C7' : '#FEE2E2',
                      color:      item.confidence === 'HIGH' ? '#065F46' : item.confidence === 'MEDIUM' ? '#92400E' : '#991B1B',
                    }}>{item.confidence}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Room breakdown */}
      {roomBreakdown.length > 0 && (
        <div style={{ ...card, marginBottom: 16 }}>
          <p style={sectionTitle}>Room-by-room assessment</p>
          {roomBreakdown.map((room, i) => (
            <div key={i} style={{
              padding: '14px 0',
              borderBottom: i < roomBreakdown.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{room.roomName}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                  background: room.condition === 'GOOD' ? '#D1FAE5' : room.condition === 'FAIR' ? '#FEF3C7' : room.condition === 'POOR' ? '#FED7AA' : '#FEE2E2',
                  color:      room.condition === 'GOOD' ? '#065F46' : room.condition === 'FAIR' ? '#92400E' : room.condition === 'POOR' ? '#9A3412' : '#991B1B',
                }}>{room.condition}</span>
              </div>
              {room.issues.length > 0 && (
                <ul style={{ margin: '0 0 6px', paddingLeft: 18, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                  {room.issues.map((iss, j) => <li key={j}>{iss}</li>)}
                </ul>
              )}
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-primary)' }}>
                <strong>Recommended:</strong> {room.recommendedWork}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Cannot assess */}
      {cannotAssess.length > 0 && (
        <div style={{ ...card, marginBottom: 16, background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <p style={sectionTitle}>
            <AlertTriangle size={14} strokeWidth={2} style={{ marginRight: 6 }} />
            Items we couldn't assess
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#92400E', lineHeight: 1.7 }}>
            {cannotAssess.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      {/* Rationale */}
      {estimate.ai_rationale && (
        <div style={{ ...card, marginBottom: 16 }}>
          <p style={sectionTitle}>How we estimated this</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
            {estimate.ai_rationale}
          </p>
        </div>
      )}

      <Button variant="secondary" onClick={onNewEstimate}>
        Start a new estimate
      </Button>
    </div>
  );
}

const centerStyle:  React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 20px' };
const mutedText:    React.CSSProperties = { fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 400, lineHeight: 1.6, margin: 0 };
const card:         React.CSSProperties = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 };
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center' };
const confBadge:    React.CSSProperties = { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10, background: '#E8F4F0', color: 'var(--color-accent)' };
const th:           React.CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-text-muted)', fontWeight: 500 };
const td:           React.CSSProperties = { padding: '10px 12px' };
