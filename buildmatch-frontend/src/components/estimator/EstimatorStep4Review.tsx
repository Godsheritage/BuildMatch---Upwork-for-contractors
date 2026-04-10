import { useState } from 'react';
import { CheckCircle2, Camera, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { createEstimate } from '../../services/property.service';
import type { WizardState } from '../../pages/EstimatorPage';

const PURPOSES: Record<string, string> = {
  FLIP: 'Fix & flip', RENTAL: 'Rental property',
  PRIMARY_RESIDENCE: 'Primary residence', WHOLESALE: 'Wholesale',
};
const ISSUES: Record<string, string> = {
  COSMETIC: 'Cosmetic refresh', FULL_GUT: 'Full gut renovation',
  WATER_DAMAGE: 'Water damage', FIRE_DAMAGE: 'Fire damage',
  NEGLECT: 'Deferred maintenance', STRUCTURAL: 'Structural issues', PARTIAL: 'Partial renovation',
};

interface Props {
  wizard:   WizardState;
  onNext:   (patch: Partial<WizardState>) => void;
  onUpdate?: (patch: Partial<WizardState>) => void;
}

export function EstimatorStep4Review({ wizard, onNext }: Props) {
  const { toast } = useToast();
  const [purpose,    setPurpose]    = useState('FLIP');
  const [issue,      setIssue]     = useState('COSMETIC');
  const [submitting, setSubmitting] = useState(false);

  const { property, photos, answers } = wizard;
  const totalPhotos = Object.values(photos).reduce((s, arr) => s + arr.length, 0);
  const areasUsed   = Object.keys(photos).filter(k => (photos[k]?.length ?? 0) > 0);
  const answered    = Object.values(answers).filter(v => v.trim()).length;

  async function handleSubmit() {
    if (!property.id) { toast('Property not saved.', 'error'); return; }

    const photoIds = Object.values(photos).flat().map(p => p.photoId);
    if (photoIds.length < 4) { toast('At least 4 photos required.', 'error'); return; }

    setSubmitting(true);
    try {
      const est = await createEstimate({
        property_id:        property.id,
        renovation_purpose: purpose,
        primary_issue:      issue,
      });

      onNext({
        estimateId:     est.id,
        estimateStatus: 'PROCESSING',
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start estimate.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 style={heading}>Review &amp; submit</h2>
      <p style={subtext}>Confirm your property details and select your renovation intent before generating the estimate.</p>

      {/* Property summary */}
      <div style={card}>
        <p style={sectionTitle}>Property</p>
        <p style={infoLine}>{property.addressLine1}{property.addressLine2 ? `, ${property.addressLine2}` : ''}</p>
        <p style={infoLine}>{property.city}, {property.state} {property.zipCode}</p>
        <p style={infoMuted}>
          {property.propertyType.replace(/_/g, ' ')}
          {property.sqftEstimate ? ` · ${property.sqftEstimate} sqft` : ''}
          {property.bedrooms ? ` · ${property.bedrooms} bed` : ''}
          {property.bathrooms ? ` / ${property.bathrooms} bath` : ''}
        </p>
      </div>

      {/* Photos summary */}
      <div style={card}>
        <p style={sectionTitle}>
          <Camera size={14} strokeWidth={2} style={{ marginRight: 6 }} />
          {totalPhotos} photos across {areasUsed.length} areas
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {areasUsed.map(key => (
            <span key={key} style={areaBadge}>
              <CheckCircle2 size={11} strokeWidth={2.5} /> {key.replace(/_/g, ' ').toLowerCase()}
              <span style={{ opacity: 0.6 }}>({photos[key]?.length})</span>
            </span>
          ))}
        </div>
      </div>

      {/* Questionnaire summary */}
      <div style={card}>
        <p style={sectionTitle}>{answered} questionnaire answers</p>
        {answered === 0 && (
          <p style={infoMuted}>No answers provided — the AI will rely on photos only.</p>
        )}
      </div>

      {/* Renovation intent */}
      <div style={card}>
        <p style={sectionTitle}>Renovation intent</p>

        <label style={fieldLabel}>Purpose</label>
        <select style={input} value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          {Object.entries(PURPOSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <label style={{ ...fieldLabel, marginTop: 14 }}>Primary issue</label>
        <select style={input} value={issue} onChange={(e) => setIssue(e.target.value)}>
          {Object.entries(ISSUES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
        <Sparkles size={15} strokeWidth={2} />
        {submitting ? 'Starting…' : 'Generate estimate'}
      </Button>
    </div>
  );
}

const heading:      React.CSSProperties = { fontSize: 20, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' };
const subtext:      React.CSSProperties = { fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.5 };
const card:         React.CSSProperties = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 16 };
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: '0 0 10px', display: 'flex', alignItems: 'center' };
const infoLine:     React.CSSProperties = { margin: 0, fontSize: 14, color: 'var(--color-text-primary)' };
const infoMuted:    React.CSSProperties = { margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' };
const fieldLabel:   React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 };
const input:        React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid var(--color-border)', borderRadius: 8, fontFamily: 'inherit' };
const areaBadge:    React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 8,
  background: '#E8F4F0', color: '#065F46', textTransform: 'capitalize',
};
