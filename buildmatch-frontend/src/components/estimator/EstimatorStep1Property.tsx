import { useState } from 'react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { createProperty } from '../../services/property.service';
import type { WizardProperty } from '../../pages/EstimatorPage';

const PROPERTY_TYPES = [
  { value: 'SINGLE_FAMILY', label: 'Single family' },
  { value: 'DUPLEX',        label: 'Duplex' },
  { value: 'TRIPLEX',       label: 'Triplex' },
  { value: 'FOURPLEX',      label: 'Fourplex' },
  { value: 'TOWNHOUSE',     label: 'Townhouse' },
  { value: 'CONDO',         label: 'Condo' },
  { value: 'MULTI_FAMILY',  label: 'Multi-family' },
  { value: 'COMMERCIAL',    label: 'Commercial' },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

interface Props {
  property: WizardProperty;
  onNext:   (property: WizardProperty) => void;
}

export function EstimatorStep1Property({ property, onNext }: Props) {
  const { toast } = useToast();
  const [f, setF] = useState<WizardProperty>({ ...property });
  const [saving, setSaving] = useState(false);

  function set(key: keyof WizardProperty, val: string | boolean) {
    setF((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit() {
    if (!f.addressLine1.trim() || !f.city.trim() || !f.state || !/^\d{5}$/.test(f.zipCode)) {
      toast('Fill in all required fields (address, city, 2-letter state, 5-digit ZIP).', 'error');
      return;
    }

    // If property already saved (navigated back), skip creation
    if (f.id) { onNext(f); return; }

    setSaving(true);
    try {
      const created = await createProperty({
        address_line1: f.addressLine1,
        address_line2: f.addressLine2 || undefined,
        city:          f.city,
        state:         f.state,
        zip_code:      f.zipCode,
        property_type: f.propertyType as import('../../services/property.service').PropertyType,
        year_built:    f.yearBuilt ? parseInt(f.yearBuilt) : undefined,
        sqft_estimate: f.sqftEstimate ? parseInt(f.sqftEstimate) : undefined,
        bedrooms:      f.bedrooms ? parseInt(f.bedrooms) : undefined,
        bathrooms:     f.bathrooms ? parseFloat(f.bathrooms) : undefined,
        has_basement:  f.hasBasement,
        has_garage:    f.hasGarage,
        stories:       parseInt(f.stories) || 1,
      } as Partial<import('../../services/property.service').Property>);
      onNext({ ...f, id: created.id });
    } catch {
      toast('Could not save property. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={heading}>Property details</h2>
      <p style={subtext}>Tell us about the property you'd like to estimate.</p>

      <div style={card}>
        <Field label="Address *">
          <input style={input} value={f.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} placeholder="123 Main St" />
        </Field>
        <Field label="Address line 2">
          <input style={input} value={f.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} placeholder="Apt, suite, unit" />
        </Field>
        <TwoCol>
          <Field label="City *">
            <input style={input} value={f.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="State *">
            <select style={input} value={f.state} onChange={(e) => set('state', e.target.value)}>
              <option value="">Select…</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </TwoCol>
        <TwoCol>
          <Field label="ZIP code *">
            <input style={input} value={f.zipCode} onChange={(e) => set('zipCode', e.target.value.replace(/\D/g, '').slice(0, 5))} inputMode="numeric" maxLength={5} placeholder="21218" />
          </Field>
          <Field label="Property type">
            <select style={input} value={f.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </TwoCol>

        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 8, paddingTop: 16 }}>
          <p style={{ ...subtext, marginBottom: 12 }}>Optional — helps the AI produce a better estimate</p>
          <TwoCol>
            <Field label="Year built">
              <input style={input} type="number" value={f.yearBuilt} onChange={(e) => set('yearBuilt', e.target.value)} placeholder="e.g. 1985" />
            </Field>
            <Field label="Est. sqft">
              <input style={input} type="number" value={f.sqftEstimate} onChange={(e) => set('sqftEstimate', e.target.value)} placeholder="e.g. 1800" />
            </Field>
          </TwoCol>
          <TwoCol>
            <Field label="Bedrooms">
              <input style={input} type="number" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} placeholder="3" />
            </Field>
            <Field label="Bathrooms">
              <input style={input} type="number" step="0.5" value={f.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} placeholder="2" />
            </Field>
          </TwoCol>
          <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
            <label style={checkLabel}>
              <input type="checkbox" checked={f.hasBasement} onChange={(e) => set('hasBasement', e.target.checked)} />
              Basement
            </label>
            <label style={checkLabel}>
              <input type="checkbox" checked={f.hasGarage} onChange={(e) => set('hasGarage', e.target.checked)} />
              Garage
            </label>
          </div>
          <Field label="Stories">
            <input style={{ ...input, maxWidth: 100 }} type="number" value={f.stories} onChange={(e) => set('stories', e.target.value)} min="1" max="10" />
          </Field>
        </div>
      </div>

      <Button variant="primary" onClick={handleSubmit} disabled={saving}>
        {saving ? 'Saving…' : 'Continue'}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
function TwoCol({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

const heading:    React.CSSProperties = { fontSize: 20, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' };
const subtext:    React.CSSProperties = { fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.5 };
const card:       React.CSSProperties = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 20 };
const input:      React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid var(--color-border)', borderRadius: 8, fontFamily: 'inherit' };
const checkLabel: React.CSSProperties = { fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' };
