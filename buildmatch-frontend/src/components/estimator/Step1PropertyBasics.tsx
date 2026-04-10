import { useState, useRef, useCallback } from 'react';
import {
  Home, Building, Building2, Castle, Warehouse, Store, Landmark,
  Minus, Plus, Loader,
} from 'lucide-react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { createProperty } from '../../services/property.service';
import type { WizardState, WizardProperty } from '../../pages/EstimatorPage';
import type { Property } from '../../services/property.service';

// ── Constants ────────────────────────────────────────────────────────────────

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const LIBRARIES: ('places')[] = ['places'];

interface PropTypeOption {
  value: string;
  label: string;
  icon:  React.ElementType;
}

const PROPERTY_TYPES: PropTypeOption[] = [
  { value: 'SINGLE_FAMILY', label: 'Single Family', icon: Home },
  { value: 'DUPLEX',        label: 'Duplex',        icon: Building },
  { value: 'TRIPLEX',       label: 'Triplex',       icon: Building },
  { value: 'FOURPLEX',      label: 'Fourplex',      icon: Building2 },
  { value: 'TOWNHOUSE',     label: 'Townhouse',     icon: Castle },
  { value: 'CONDO',         label: 'Condo',         icon: Landmark },
  { value: 'MULTI_FAMILY',  label: 'Multi-Family',  icon: Warehouse },
  { value: 'COMMERCIAL',    label: 'Commercial',    icon: Store },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  state:  WizardState;
  onNext: (updated: WizardState) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function Step1PropertyBasics({ state, onNext }: Props) {
  const { toast }     = useToast();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const [f, setF]         = useState<WizardProperty>({ ...state.property });
  const [errors, setErrors] = useState<Partial<Record<keyof WizardProperty, string>>>({});
  const [saving, setSaving] = useState(false);

  // Load Google Maps Script
  const { isLoaded: mapsLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_KEY || '',
    libraries:        LIBRARIES,
  });

  // ── Field helpers ──────────────────────────────────────────────────────────

  function set<K extends keyof WizardProperty>(key: K, val: WizardProperty[K]) {
    setF((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // ── Places autocomplete ────────────────────────────────────────────────────

  const onPlaceSelect = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.address_components) return;

    let street = '';
    let city   = '';
    let stateShort = '';
    let zip    = '';

    for (const comp of place.address_components) {
      const t = comp.types;
      if (t.includes('street_number'))              street = comp.long_name + ' ';
      if (t.includes('route'))                      street += comp.long_name;
      if (t.includes('locality'))                   city   = comp.long_name;
      if (t.includes('sublocality_level_1') && !city) city = comp.long_name;
      if (t.includes('administrative_area_level_1')) stateShort = comp.short_name;
      if (t.includes('postal_code'))                zip = comp.long_name;
    }

    setF((prev) => ({
      ...prev,
      addressLine1: street.trim() || prev.addressLine1,
      city:         city   || prev.city,
      state:        stateShort || prev.state,
      zipCode:      zip    || prev.zipCode,
    }));
    setErrors({});
  }, []);

  // ── Steppers ───────────────────────────────────────────────────────────────

  function stepper(key: 'bedrooms' | 'bathrooms' | 'stories', step: number, min: number, max: number) {
    const val = parseFloat(f[key]) || 0;
    return {
      value:     val,
      dec:       () => set(key, String(Math.max(min, val - step))),
      inc:       () => set(key, String(Math.min(max, val + step))),
      canDec:    val > min,
      canInc:    val < max,
    };
  }

  const bed  = stepper('bedrooms',  1,   0, 20);
  const bath = stepper('bathrooms', 0.5, 0, 20);
  const stor = stepper('stories',   1,   1, 10);

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: Partial<Record<keyof WizardProperty, string>> = {};
    if (!f.addressLine1.trim())         e.addressLine1 = 'Street address is required';
    if (!f.city.trim())                 e.city         = 'City is required';
    if (!f.state || f.state.length < 2) e.state        = 'State is required';
    if (!/^\d{5}$/.test(f.zipCode))     e.zipCode      = 'Enter a valid 5-digit ZIP';
    if (!f.propertyType)                e.propertyType = 'Select a property type';
    if (!f.bedrooms && f.bedrooms !== '0') e.bedrooms  = 'Required';
    if (!f.bathrooms && f.bathrooms !== '0') e.bathrooms = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleNext() {
    if (!validate()) return;

    // If already saved (user navigated back), skip API call
    if (f.id) {
      onNext({ ...state, property: f, currentStep: 2 });
      return;
    }

    setSaving(true);
    try {
      const created = await createProperty({
        address_line1: f.addressLine1,
        address_line2: f.addressLine2 || undefined,
        city:          f.city,
        state:         f.state,
        zip_code:      f.zipCode,
        property_type: f.propertyType,
        year_built:    f.yearBuilt ? parseInt(f.yearBuilt) : undefined,
        sqft_estimate: f.sqftEstimate ? parseInt(f.sqftEstimate) : undefined,
        bedrooms:      parseInt(f.bedrooms) || 0,
        bathrooms:     parseFloat(f.bathrooms) || 0,
        has_basement:  f.hasBasement,
        has_garage:    f.hasGarage,
        stories:       parseInt(f.stories) || 1,
      } as Partial<Property>);

      const updated: WizardProperty = { ...f, id: created.id };
      onNext({ ...state, property: updated, currentStep: 2 });
    } catch {
      toast('Could not save property. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <h2 style={heading}>Tell us about the property</h2>
      <p style={subtitle}>We use these details to improve the accuracy of your estimate.</p>

      {/* ── Address section ─────────────────────────────────────────────── */}
      <div style={card}>
        <SectionLabel>Address</SectionLabel>

        <FieldWrap label="Street address *" error={errors.addressLine1}>
          {mapsLoaded && GOOGLE_MAPS_KEY ? (
            <Autocomplete
              onLoad={(a) => { autocompleteRef.current = a; }}
              onPlaceChanged={onPlaceSelect}
              options={{ componentRestrictions: { country: 'us' }, types: ['address'] }}
            >
              <input
                style={errors.addressLine1 ? { ...inputStyle, ...inputError } : inputStyle}
                value={f.addressLine1}
                onChange={(e) => set('addressLine1', e.target.value)}
                placeholder="Start typing an address…"
                disabled={saving}
              />
            </Autocomplete>
          ) : (
            <input
              style={errors.addressLine1 ? { ...inputStyle, ...inputError } : inputStyle}
              value={f.addressLine1}
              onChange={(e) => set('addressLine1', e.target.value)}
              placeholder="123 Main St"
              disabled={saving}
            />
          )}
        </FieldWrap>

        <FieldWrap label="Unit / Apt / Suite">
          <input
            style={inputStyle}
            value={f.addressLine2}
            onChange={(e) => set('addressLine2', e.target.value)}
            placeholder="Apt 2B"
            disabled={saving}
          />
        </FieldWrap>

        <div style={twoCol}>
          <FieldWrap label="City *" error={errors.city}>
            <input
              style={errors.city ? { ...inputStyle, ...inputError } : inputStyle}
              value={f.city}
              onChange={(e) => set('city', e.target.value)}
              disabled={saving}
            />
          </FieldWrap>
          <FieldWrap label="State *" error={errors.state}>
            <input
              style={errors.state ? { ...inputStyle, ...inputError } : inputStyle}
              value={f.state}
              onChange={(e) => set('state', e.target.value.toUpperCase().slice(0, 2))}
              placeholder="MD"
              maxLength={2}
              disabled={saving}
            />
          </FieldWrap>
        </div>

        <FieldWrap label="ZIP code *" error={errors.zipCode}>
          <input
            style={{
              ...(errors.zipCode ? { ...inputStyle, ...inputError } : inputStyle),
              maxWidth: 160,
            }}
            value={f.zipCode}
            onChange={(e) => set('zipCode', e.target.value.replace(/\D/g, '').slice(0, 5))}
            inputMode="numeric"
            maxLength={5}
            placeholder="21218"
            disabled={saving}
          />
        </FieldWrap>
      </div>

      {/* ── Property type cards ─────────────────────────────────────────── */}
      <div style={card}>
        <SectionLabel>Property type *</SectionLabel>
        {errors.propertyType && <p style={errorText}>{errors.propertyType}</p>}

        <div style={typeGrid}>
          {PROPERTY_TYPES.map(({ value, label, icon: Icon }) => {
            const selected = f.propertyType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => set('propertyType', value)}
                disabled={saving}
                style={{
                  ...typeCard,
                  borderColor: selected ? 'var(--color-primary)' : 'var(--color-border)',
                  background:  selected ? 'rgba(27, 58, 92, 0.06)' : '#fff',
                }}
              >
                <Icon
                  size={22}
                  strokeWidth={1.5}
                  color={selected ? 'var(--color-primary)' : 'var(--color-text-muted)'}
                />
                <span style={{
                  fontSize: 12, fontWeight: 500, marginTop: 4,
                  color: selected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Property details ────────────────────────────────────────────── */}
      <div style={card}>
        <SectionLabel>Property details</SectionLabel>

        <div style={twoCol}>
          <FieldWrap label="Year built" helper="Approximate is fine">
            <input
              style={inputStyle}
              type="number"
              value={f.yearBuilt}
              onChange={(e) => set('yearBuilt', e.target.value)}
              placeholder="1975"
              disabled={saving}
            />
          </FieldWrap>
          <FieldWrap label="Square footage" helper="Check the listing or county records if unsure">
            <input
              style={inputStyle}
              type="number"
              value={f.sqftEstimate}
              onChange={(e) => set('sqftEstimate', e.target.value)}
              placeholder="1,400"
              disabled={saving}
            />
          </FieldWrap>
        </div>

        <div style={twoCol}>
          <FieldWrap label="Bedrooms *" error={errors.bedrooms}>
            <StepperInput value={bed.value} onDec={bed.dec} onInc={bed.inc} canDec={bed.canDec} canInc={bed.canInc} disabled={saving} />
          </FieldWrap>
          <FieldWrap label="Bathrooms *" error={errors.bathrooms}>
            <StepperInput value={bath.value} onDec={bath.dec} onInc={bath.inc} canDec={bath.canDec} canInc={bath.canInc} disabled={saving} />
          </FieldWrap>
        </div>

        <FieldWrap label="Stories">
          <StepperInput value={stor.value} onDec={stor.dec} onInc={stor.inc} canDec={stor.canDec} canInc={stor.canInc} disabled={saving} />
        </FieldWrap>

        <div style={{ display: 'flex', gap: 32, marginTop: 8 }}>
          <ToggleSwitch label="Basement?" checked={f.hasBasement} onChange={(v) => set('hasBasement', v)} disabled={saving} />
          <ToggleSwitch label="Garage?"   checked={f.hasGarage}   onChange={(v) => set('hasGarage', v)}   disabled={saving} />
        </div>
      </div>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <Button
        variant="primary"
        onClick={handleNext}
        disabled={saving}
        className="w-full justify-center"
      >
        {saving ? (
          <>
            <Loader size={15} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
            Saving…
          </>
        ) : (
          'Next: Add Photos'
        )}
      </Button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: 0.6, color: 'var(--color-text-muted)', margin: '0 0 14px',
    }}>
      {children}
    </p>
  );
}

function FieldWrap({
  label, error, helper, children,
}: { label: string; error?: string; helper?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error  && <p style={errorText}>{error}</p>}
      {helper && !error && <p style={helperText}>{helper}</p>}
    </div>
  );
}

function StepperInput({
  value, onDec, onInc, canDec, canInc, disabled,
}: { value: number; onDec: () => void; onInc: () => void; canDec: boolean; canInc: boolean; disabled?: boolean }) {
  return (
    <div style={stepperWrap}>
      <button
        type="button"
        onClick={onDec}
        disabled={!canDec || disabled}
        style={stepperBtn}
        aria-label="Decrease"
      >
        <Minus size={14} strokeWidth={2} />
      </button>
      <span style={stepperValue}>
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
      <button
        type="button"
        onClick={onInc}
        disabled={!canInc || disabled}
        style={stepperBtn}
        aria-label="Increase"
      >
        <Plus size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

function ToggleSwitch({
  label, checked, onChange, disabled,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)',
      cursor: disabled ? 'default' : 'pointer',
    }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, padding: 2,
          background: checked ? 'var(--color-accent)' : '#D1D5DB',
          border: 'none', cursor: disabled ? 'default' : 'pointer',
          transition: 'background 0.2s',
          display: 'flex', alignItems: 'center',
        }}
      >
        <span style={{
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'transform 0.2s',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
      </button>
      {label}
    </label>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const heading:  React.CSSProperties = { fontSize: 22, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em', color: 'var(--color-text-primary)' };
const subtitle: React.CSSProperties = { fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 24px', lineHeight: 1.5 };

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--color-border)',
  borderRadius: 12, padding: '20px 22px', marginBottom: 20,
};

const twoCol: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', fontSize: 14,
  border: '1px solid var(--color-border)', borderRadius: 8,
  fontFamily: 'inherit', color: 'var(--color-text-primary)',
  background: '#fff', transition: 'border-color 0.15s',
};

const inputError: React.CSSProperties = {
  borderColor: 'var(--color-danger)',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500,
  color: 'var(--color-text-primary)', marginBottom: 6,
};

const errorText: React.CSSProperties = {
  fontSize: 12, color: 'var(--color-danger)', margin: '4px 0 0',
};

const helperText: React.CSSProperties = {
  fontSize: 11, color: 'var(--color-text-muted)', margin: '4px 0 0',
};

const typeGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 10,
};

const typeCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  gap: 2, padding: '16px 8px',
  border: '1.5px solid var(--color-border)',
  borderRadius: 10, cursor: 'pointer',
  background: '#fff', transition: 'all 0.15s',
};

const stepperWrap: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  border: '1px solid var(--color-border)', borderRadius: 8,
  overflow: 'hidden', height: 42,
};

const stepperBtn: React.CSSProperties = {
  width: 40, height: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#F8F7F5', border: 'none', cursor: 'pointer',
  color: 'var(--color-text-primary)',
};

const stepperValue: React.CSSProperties = {
  width: 48, textAlign: 'center',
  fontSize: 15, fontWeight: 600,
  color: 'var(--color-text-primary)',
  borderLeft: '1px solid var(--color-border)',
  borderRight: '1px solid var(--color-border)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: '100%',
};
