import { useState } from 'react';
import {
  MapPin, Home, Camera, Sparkles, AlertTriangle,
  ChevronRight, Loader, Info,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import type { WizardState } from '../../pages/EstimatorPage';

// ── Label maps ───────────────────────────────────────────────────────────────

const PURPOSE_LABELS: Record<string, string> = {
  FLIP:               'Fix & Flip',
  RENTAL:             'Buy & Hold Rental',
  PRIMARY_RESIDENCE:  'Primary Residence',
  WHOLESALE:          'Wholesale / Assign',
};

const ISSUE_LABELS: Record<string, string> = {
  COSMETIC:     'Cosmetic Only',
  PARTIAL:      'Partial Renovation',
  FULL_GUT:     'Full Gut Renovation',
  WATER_DAMAGE: 'Water Damage',
  FIRE_DAMAGE:  'Fire / Smoke Damage',
  NEGLECT:      'Neglected / Abandoned',
  STRUCTURAL:   'Structural Issues',
};

const TYPE_LABELS: Record<string, string> = {
  SINGLE_FAMILY: 'Single Family',
  DUPLEX:        'Duplex',
  TRIPLEX:       'Triplex',
  FOURPLEX:      'Fourplex',
  TOWNHOUSE:     'Townhouse',
  CONDO:         'Condo',
  MULTI_FAMILY:  'Multi-Family',
  COMMERCIAL:    'Commercial',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  state:  WizardState;
  onNext: (updated: WizardState) => void;
  onBack: () => void;
  onGoToStep: (step: 1 | 2 | 3 | 4 | 5) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function Step4ReviewSubmit({ state, onNext, onGoToStep }: Props) {
  const { toast }       = useToast();
  const [agreed, setAgreed]       = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { property, photos, answers } = state;

  // Photo stats
  const allPhotos   = Object.values(photos).flat();
  const totalPhotos = allPhotos.length;
  const areaCount   = Object.keys(photos).filter(k => (photos[k]?.length ?? 0) > 0).length;

  // Pick up to 5 thumbnails from different areas for the preview strip
  const previewPhotos: { url: string; areaKey: string }[] = [];
  const seenAreas = new Set<string>();
  for (const p of allPhotos) {
    const areaKey = Object.entries(photos).find(([, arr]) => arr.some(x => x.photoId === p.photoId))?.[0] ?? '';
    if (!seenAreas.has(areaKey)) {
      previewPhotos.push({ url: p.url, areaKey });
      seenAreas.add(areaKey);
    }
    if (previewPhotos.length >= 5) break;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!agreed) return;
    if (!property.id) { toast('Property not saved.', 'error'); return; }

    const photoIds = allPhotos.map(p => p.photoId);
    if (photoIds.length < 4) { toast('At least 4 photos required.', 'error'); return; }

    setSubmitting(true);
    try {
      const resp = await api.post<{
        success: boolean;
        data: { estimateId: string; status: string };
      }>('/estimator/estimates', {
        propertyId:           property.id,
        renovationPurpose:    answers.renovation_purpose ?? 'FLIP',
        primaryIssue:         answers.primary_issue ?? 'COSMETIC',
        questionnaireAnswers: answers,
        photoIds,
      });

      const { estimateId } = resp.data.data;
      onNext({
        ...state,
        estimateId,
        estimateStatus: 'PROCESSING',
        currentStep: 5,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start estimation.';
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 24 }}>
      <h2 style={heading}>Ready to generate your estimate</h2>

      {/* ── Property + intent summary ────────────────────────────────────── */}
      <div style={card}>
        <div style={summaryGrid}>
          {/* Left column — property */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <MapPin size={14} strokeWidth={2} color="var(--color-text-muted)" />
              <span style={sectionLabel}>Property</span>
            </div>
            <p style={infoLine}>{property.addressLine1}</p>
            {property.addressLine2 && <p style={infoLineMuted}>{property.addressLine2}</p>}
            <p style={infoLine}>{property.city}, {property.state} {property.zipCode}</p>
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              <span>{TYPE_LABELS[property.propertyType] ?? property.propertyType}</span>
              {property.bedrooms && <span> · {property.bedrooms} bed</span>}
              {property.bathrooms && <span> / {property.bathrooms} bath</span>}
              {property.sqftEstimate && <span> · {parseInt(property.sqftEstimate).toLocaleString()} sqft</span>}
              {property.yearBuilt && <span> · Built {property.yearBuilt}</span>}
            </div>
          </div>

          {/* Right column — intent */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Home size={14} strokeWidth={2} color="var(--color-text-muted)" />
              <span style={sectionLabel}>Renovation intent</span>
            </div>
            <p style={infoLine}>{PURPOSE_LABELS[answers.renovation_purpose] ?? answers.renovation_purpose ?? '—'}</p>
            <p style={{ ...infoLineMuted, marginTop: 4 }}>
              {ISSUE_LABELS[answers.primary_issue] ?? answers.primary_issue ?? '—'}
            </p>
          </div>
        </div>

        <button type="button" onClick={() => onGoToStep(1)} style={editLink}>
          Edit property details <ChevronRight size={12} />
        </button>
      </div>

      {/* ── Photo summary ────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Camera size={15} strokeWidth={2} color="var(--color-accent)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {totalPhotos} photos across {areaCount} areas
          </span>
        </div>

        {previewPhotos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
            {previewPhotos.map((p, i) => (
              <img
                key={i}
                src={p.url}
                alt=""
                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid var(--color-border)' }}
              />
            ))}
          </div>
        )}

        <button type="button" onClick={() => onGoToStep(2)} style={editLink}>
          Edit photos <ChevronRight size={12} />
        </button>
      </div>

      {/* ── What happens next ────────────────────────────────────────────── */}
      <div style={tealCallout}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Info size={15} strokeWidth={2} color="#065F46" />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#065F46' }}>What happens next</span>
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#065F46', lineHeight: 1.7 }}>
          <li>BuildMatch AI analyzes all {totalPhotos} photos and your answers</li>
          <li>Our model cross-references regional construction costs for {property.city}, {property.state}</li>
          <li>You receive a room-by-room cost breakdown in 15–40 seconds</li>
        </ol>
      </div>

      {/* ── Disclaimer ───────────────────────────────────────────────────── */}
      <div style={amberCallout}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <AlertTriangle size={15} strokeWidth={2} color="#92400E" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>Important disclaimer</span>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
          This estimate is based on visible conditions in your photos and the information you provided. It does not account for:
        </p>
        <ul style={{ margin: '0 0 14px', paddingLeft: 20, fontSize: 13, color: '#78350F', lineHeight: 1.7 }}>
          <li>Conditions behind walls, ceilings, or under floors</li>
          <li>Electrical, plumbing, or structural issues not visible in photos</li>
          <li>Local permit costs and requirements</li>
          <li>Material price fluctuations</li>
        </ul>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#78350F', lineHeight: 1.6, fontWeight: 500 }}>
          Actual contractor bids may vary by 20–40% from this estimate. Always obtain at least 3 contractor bids before committing to a purchase.
        </p>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
          padding: '10px 12px', background: 'rgba(255,255,255,0.6)',
          borderRadius: 8, border: `1.5px solid ${agreed ? 'var(--color-accent)' : '#FDE68A'}`,
          transition: 'border-color 0.2s',
        }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--color-accent)', marginTop: 1, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#78350F', lineHeight: 1.5 }}>
            I understand this is a rough estimate for due diligence purposes only
          </span>
        </label>
      </div>

      {/* ── Submit button ────────────────────────────────────────────────── */}
      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={!agreed || submitting}
        className="w-full justify-center"
        style={{ padding: '16px 24px', fontSize: 16, marginTop: 8 }}
      >
        {submitting ? (
          <>
            <Loader size={16} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
            Starting analysis…
          </>
        ) : (
          <>
            <Sparkles size={16} strokeWidth={2} />
            Generate My Estimate
          </>
        )}
      </Button>

      {!agreed && !submitting && (
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 8 }}>
          Check the disclaimer box above to enable this button
        </p>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const heading: React.CSSProperties = {
  fontSize: 22, fontWeight: 600, margin: '0 0 20px', letterSpacing: '-0.02em',
};

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--color-border)',
  borderRadius: 12, padding: 20, marginBottom: 16,
};

const summaryGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: 0.6, color: 'var(--color-text-muted)',
};

const infoLine: React.CSSProperties = {
  margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)',
};

const infoLineMuted: React.CSSProperties = {
  margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-muted)',
};

const editLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 12, fontWeight: 500, color: 'var(--color-accent)',
  padding: '8px 0 0',
};

const tealCallout: React.CSSProperties = {
  padding: '16px 18px', marginBottom: 16,
  background: '#ECFDF5', border: '1px solid #A7F3D0',
  borderRadius: 12,
};

const amberCallout: React.CSSProperties = {
  padding: '16px 18px', marginBottom: 20,
  background: '#FFFBEB', border: '1px solid #FDE68A',
  borderRadius: 12,
};
