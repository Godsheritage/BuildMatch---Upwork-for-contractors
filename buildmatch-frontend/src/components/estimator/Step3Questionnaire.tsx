import { useState } from 'react';
import {
  TrendingUp, Home, Building2, FileText,
  Paintbrush, Wrench, Hammer, Droplets, Flame, Clock, AlertTriangle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import type { WizardState } from '../../pages/EstimatorPage';

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  state:  WizardState;
  onNext: (updated: WizardState) => void;
  onBack: () => void;
}

// ── Option types ─────────────────────────────────────────────────────────────

interface CardOption { value: string; label: string; desc: string; icon?: React.ElementType }
interface RadioOption { value: string; label: string }
interface CheckOption { value: string; label: string }

// ── Q1 Renovation purpose ────────────────────────────────────────────────────

const PURPOSE_OPTIONS: CardOption[] = [
  { value: 'FLIP',               label: 'Fix & Flip',           desc: 'Investor-grade finishes to maximize resale value',           icon: TrendingUp },
  { value: 'RENTAL',             label: 'Buy & Hold Rental',    desc: 'Durable mid-grade finishes for long-term tenants',           icon: Building2 },
  { value: 'PRIMARY_RESIDENCE',  label: 'Primary Residence',    desc: 'High-quality finishes for personal use',                     icon: Home },
  { value: 'WHOLESALE',          label: 'Wholesale / Assign',   desc: 'Rough estimate only for deal analysis',                      icon: FileText },
];

// ── Q2 Primary issue ─────────────────────────────────────────────────────────

const ISSUE_OPTIONS: CardOption[] = [
  { value: 'COSMETIC',    label: 'Cosmetic Only',           desc: 'Paint, flooring, fixtures — no structural work',      icon: Paintbrush },
  { value: 'PARTIAL',     label: 'Partial Renovation',      desc: 'Some systems and cosmetics need updating',            icon: Wrench },
  { value: 'FULL_GUT',    label: 'Full Gut Renovation',     desc: 'Down to the studs in most areas',                     icon: Hammer },
  { value: 'WATER_DAMAGE',label: 'Water Damage',            desc: 'Active or recent water intrusion damage',             icon: Droplets },
  { value: 'FIRE_DAMAGE', label: 'Fire / Smoke Damage',     desc: 'Fire damage requiring remediation',                   icon: Flame },
  { value: 'NEGLECT',     label: 'Neglected / Abandoned',   desc: 'Long-term vacancy or deferred maintenance',           icon: Clock },
  { value: 'STRUCTURAL',  label: 'Structural Issues',       desc: 'Foundation, framing, or load-bearing concerns',       icon: AlertTriangle },
];

// ── Q3 Roof age ──────────────────────────────────────────────────────────────

const ROOF_AGE: RadioOption[] = [
  { value: 'under_5',     label: 'Within last 5 years' },
  { value: '5_10',        label: '5–10 years ago' },
  { value: '10_20',       label: '10–20 years ago' },
  { value: 'over_20',     label: 'More than 20 years ago' },
  { value: 'original',    label: 'Original to house' },
  { value: 'unknown',     label: 'Unknown' },
];

// ── Q4 Flooring condition ────────────────────────────────────────────────────

const FLOORING: CheckOption[] = [
  { value: 'carpet_replace',    label: 'Carpet throughout (needs replacement)' },
  { value: 'hardwood_refinish', label: 'Hardwood (needs refinishing)' },
  { value: 'hardwood_replace',  label: 'Hardwood (needs replacement)' },
  { value: 'tile_good',         label: 'Tile (good condition)' },
  { value: 'tile_replace',      label: 'Tile (needs replacement)' },
  { value: 'lvp_good',          label: 'LVP / Vinyl (good condition)' },
  { value: 'lvp_replace',       label: 'LVP / Vinyl (needs replacement)' },
  { value: 'subfloor_damage',   label: 'Subfloor damage visible' },
];

// ── Q5 Kitchen ───────────────────────────────────────────────────────────────

const KITCHEN: RadioOption[] = [
  { value: 'good', label: 'Good — dated but functional, cosmetic updates only' },
  { value: 'fair', label: 'Fair — cabinets or counters need replacement' },
  { value: 'poor', label: 'Poor — full kitchen gut and rebuild required' },
  { value: 'na',   label: 'Not applicable — no kitchen (commercial/land)' },
];

// ── Q6 Bathroom ──────────────────────────────────────────────────────────────

const BATHROOM: RadioOption[] = [
  { value: 'good',  label: 'Good — functional, cosmetic updates only' },
  { value: 'fair',  label: 'Fair — fixtures and tile need replacement' },
  { value: 'poor',  label: 'Poor — full bathroom gut required' },
  { value: 'mixed', label: 'Multiple bathrooms in different conditions' },
];

// ── Q7 HVAC age ──────────────────────────────────────────────────────────────

const HVAC_AGE: RadioOption[] = [
  { value: 'under_5',     label: 'Under 5 years' },
  { value: '5_10',        label: '5–10 years' },
  { value: '10_15',       label: '10–15 years' },
  { value: 'over_15',     label: 'Over 15 years' },
  { value: 'unknown',     label: 'Unknown' },
  { value: 'none',        label: 'No HVAC (window units)' },
];

// ── Q8 Electrical ────────────────────────────────────────────────────────────

const ELECTRICAL: RadioOption[] = [
  { value: 'modern',    label: 'Modern panel (updated within 15 years)' },
  { value: 'older',     label: 'Older panel but functional (100A or 200A)' },
  { value: 'fpe_zinsco',label: 'Federal Pacific or Zinsco panel (needs replacement)' },
  { value: 'fuse_box',  label: 'Fuse box (knob and tube era)' },
  { value: 'unknown',   label: 'Unknown' },
];

// ── Q9 Plumbing ──────────────────────────────────────────────────────────────

const PLUMBING: RadioOption[] = [
  { value: 'copper',        label: 'Copper (good condition)' },
  { value: 'pvc',           label: 'PVC / CPVC (modern)' },
  { value: 'galvanized',    label: 'Galvanized steel (aging, may need replacement)' },
  { value: 'polybutylene',  label: 'Polybutylene (should be replaced)' },
  { value: 'cast_iron',     label: 'Cast iron drain lines (older home)' },
  { value: 'mix_unknown',   label: 'Mix or unknown' },
];

// ── Q10 Water heater ─────────────────────────────────────────────────────────

const WATER_HEATER: RadioOption[] = [
  { value: 'functional_new', label: 'Yes, appears functional (under 10 years old)' },
  { value: 'functional_old', label: 'Yes but aging (10–15 years old)' },
  { value: 'replace',        label: 'Needs replacement (over 15 years or not functional)' },
  { value: 'unknown',        label: 'Unknown' },
];

// ── Q11 Specific concerns ────────────────────────────────────────────────────

const CONCERNS: CheckOption[] = [
  { value: 'water_leak',       label: 'Active water leak or flooding' },
  { value: 'mold',             label: 'Evidence of mold or mildew' },
  { value: 'pest',             label: 'Pest damage (termites, rodents)' },
  { value: 'foundation',       label: 'Foundation cracks or movement' },
  { value: 'knob_tube',        label: 'Knob and tube wiring' },
  { value: 'asbestos',         label: 'Asbestos-containing materials suspected' },
  { value: 'lead_paint',       label: 'Lead paint suspected (pre-1978 home)' },
  { value: 'permits',          label: 'Permit issues or code violations' },
  { value: 'none',             label: 'None of the above' },
];

// ── Q12 Inspections ──────────────────────────────────────────────────────────

const INSPECTIONS: RadioOption[] = [
  { value: 'none',          label: 'No inspections yet' },
  { value: 'home_only',     label: 'Home inspection only' },
  { value: 'home_plus',     label: 'Home inspection + specialist inspections' },
];

// ── Component ────────────────────────────────────────────────────────────────

export function Step3Questionnaire({ state, onNext, onBack }: Props) {
  const { toast } = useToast();
  const [a, setA] = useState<Record<string, string>>({ ...state.answers });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  function set(key: string, val: string) {
    setA(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: false }));
  }

  function toggleMulti(key: string, value: string) {
    const current = (a[key] ?? '').split(',').filter(Boolean);
    // "None of the above" clears others
    if (value === 'none') {
      set(key, 'none');
      return;
    }
    const without = current.filter(v => v !== 'none');
    const next = without.includes(value)
      ? without.filter(v => v !== value)
      : [...without, value];
    set(key, next.join(','));
  }

  function handleNext() {
    const e: Record<string, boolean> = {};
    if (!a.renovation_purpose) e.renovation_purpose = true;
    if (!a.primary_issue)      e.primary_issue      = true;
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast('Please select a renovation purpose and primary condition issue.', 'error');
      const el = document.querySelector('[data-q-key="renovation_purpose"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onNext({ ...state, answers: a, currentStep: 4 });
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <h2 style={heading}>A few quick questions</h2>
      <p style={subtitle}>These help our AI fill in what photos cannot always show.</p>

      {/* ── SECTION 1: RENOVATION INTENT ─────────────────────────────────── */}
      <SectionDivider label="Renovation intent" />

      <QWrap qKey="renovation_purpose" label="What is your renovation purpose? *" error={errors.renovation_purpose}>
        <div style={cardGrid2}>
          {PURPOSE_OPTIONS.map(opt => {
            const Icon = opt.icon!;
            const sel = a.renovation_purpose === opt.value;
            return (
              <button key={opt.value} type="button" onClick={() => set('renovation_purpose', opt.value)}
                style={{ ...selCard, borderColor: sel ? 'var(--color-primary)' : 'var(--color-border)', background: sel ? 'rgba(27,58,92,0.05)' : '#fff' }}>
                <Icon size={20} strokeWidth={1.5} color={sel ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                <span style={{ fontSize: 14, fontWeight: 600, color: sel ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{opt.label}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </QWrap>

      <QWrap qKey="primary_issue" label="What best describes the primary condition issue? *" error={errors.primary_issue}>
        <div style={cardGrid2}>
          {ISSUE_OPTIONS.map(opt => {
            const Icon = opt.icon!;
            const sel = a.primary_issue === opt.value;
            return (
              <button key={opt.value} type="button" onClick={() => set('primary_issue', opt.value)}
                style={{ ...selCard, borderColor: sel ? 'var(--color-primary)' : 'var(--color-border)', background: sel ? 'rgba(27,58,92,0.05)' : '#fff' }}>
                <Icon size={20} strokeWidth={1.5} color={sel ? 'var(--color-primary)' : 'var(--color-text-muted)'} />
                <span style={{ fontSize: 14, fontWeight: 600, color: sel ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{opt.label}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </QWrap>

      {/* ── SECTION 2: CONDITION ASSESSMENT ──────────────────────────────── */}
      <SectionDivider label="Condition assessment" />

      <QWrap qKey="roof_age" label="When was the roof last replaced?">
        <RadioGroup options={ROOF_AGE} value={a.roof_age} onChange={(v) => set('roof_age', v)} />
      </QWrap>

      <QWrap qKey="flooring_condition" label="What is the current flooring condition? (select all that apply)">
        <CheckGroup options={FLOORING} selectedCsv={a.flooring_condition ?? ''} onToggle={(v) => toggleMulti('flooring_condition', v)} />
      </QWrap>

      <QWrap qKey="kitchen_condition" label="Describe the kitchen condition">
        <RadioGroup options={KITCHEN} value={a.kitchen_condition} onChange={(v) => set('kitchen_condition', v)} />
      </QWrap>

      <QWrap qKey="bathroom_condition" label="Describe the bathroom(s) condition">
        <RadioGroup options={BATHROOM} value={a.bathroom_condition} onChange={(v) => set('bathroom_condition', v)} />
      </QWrap>

      {/* ── SECTION 3: SYSTEMS ───────────────────────────────────────────── */}
      <SectionDivider label="Systems" />

      <QWrap qKey="hvac_age" label="What is the approximate age of the HVAC system?">
        <RadioGroup options={HVAC_AGE} value={a.hvac_age} onChange={(v) => set('hvac_age', v)} />
      </QWrap>

      <QWrap qKey="electrical_panel" label="What is the electrical panel type and condition?">
        <RadioGroup options={ELECTRICAL} value={a.electrical_panel} onChange={(v) => set('electrical_panel', v)} />
      </QWrap>

      <QWrap qKey="plumbing_material" label="Describe the plumbing pipe material if known">
        <RadioGroup options={PLUMBING} value={a.plumbing_material} onChange={(v) => set('plumbing_material', v)} />
      </QWrap>

      <QWrap qKey="water_heater_condition" label="Is the water heater functional?">
        <RadioGroup options={WATER_HEATER} value={a.water_heater_condition} onChange={(v) => set('water_heater_condition', v)} />
      </QWrap>

      {/* ── SECTION 4: SPECIFIC CONCERNS ─────────────────────────────────── */}
      <SectionDivider label="Specific concerns" />

      <QWrap qKey="specific_concerns" label="Are there any of these specific concerns? (select all that apply)">
        <CheckGroup options={CONCERNS} selectedCsv={a.specific_concerns ?? ''} onToggle={(v) => toggleMulti('specific_concerns', v)} />
      </QWrap>

      <QWrap qKey="inspections_done" label="Have you had any professional inspections done? (optional)">
        <RadioGroup options={INSPECTIONS} value={a.inspections_done} onChange={(v) => set('inspections_done', v)} />
      </QWrap>

      <QWrap qKey="additional_notes" label="Is there anything else the AI should know about this property? (optional)">
        <textarea
          value={a.additional_notes ?? ''}
          onChange={(e) => set('additional_notes', e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="e.g. Previous owner was a hoarder, significant debris removal needed. There is a detached workshop. Permits were pulled for unpermitted addition."
          style={textareaStyle}
        />
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '4px 0 0', textAlign: 'right' }}>
          {(a.additional_notes ?? '').length}/500
        </p>
      </QWrap>

      {/* ── Sticky bottom bar ────────────────────────────────────────────── */}
      <div style={bottomBar}>
        <button type="button" onClick={onBack} style={backBtnStyle}>Back</button>
        <Button variant="primary" size="sm" onClick={handleNext}>
          Next: Review &amp; Submit
        </Button>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 18px' }}>
      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
    </div>
  );
}

function QWrap({ qKey, label, error, children }: { qKey: string; label: string; error?: boolean; children: React.ReactNode }) {
  return (
    <div data-q-key={qKey} style={{ marginBottom: 24, ...(error ? { padding: 14, border: '1.5px solid var(--color-danger)', borderRadius: 10 } : {}) }}>
      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>{label}</p>
      {children}
    </div>
  );
}

function RadioGroup({ options, value, onChange }: { options: RadioOption[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map(opt => (
        <label key={opt.value} style={radioLabel} onClick={() => onChange(opt.value)}>
          <span style={{ ...radioDot, ...(value === opt.value ? radioDotSel : {}) }}>
            {value === opt.value && <span style={radioDotInner} />}
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function CheckGroup({ options, selectedCsv, onToggle }: { options: CheckOption[]; selectedCsv: string; onToggle: (v: string) => void }) {
  const selected = new Set(selectedCsv.split(',').filter(Boolean));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map(opt => (
        <label key={opt.value} style={radioLabel}>
          <input
            type="checkbox"
            checked={selected.has(opt.value)}
            onChange={() => onToggle(opt.value)}
            style={{ width: 16, height: 16, accentColor: 'var(--color-accent)', cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const heading:  React.CSSProperties = { fontSize: 22, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' };
const subtitle: React.CSSProperties = { fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 24px', lineHeight: 1.5 };

const cardGrid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };

const selCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
  padding: '16px 14px', border: '1.5px solid var(--color-border)', borderRadius: 10,
  cursor: 'pointer', background: '#fff', textAlign: 'left', transition: 'all 0.15s',
  width: '100%',
};

const radioLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
  padding: '8px 0',
};

const radioDot: React.CSSProperties = {
  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
  border: '2px solid #D1D5DB',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'border-color 0.15s',
};
const radioDotSel: React.CSSProperties = {
  borderColor: 'var(--color-accent)',
};
const radioDotInner: React.CSSProperties = {
  width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)',
};

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: '1px solid var(--color-border)', borderRadius: 8,
  fontFamily: 'inherit', color: 'var(--color-text-primary)',
  resize: 'vertical',
};

const bottomBar: React.CSSProperties = {
  position: 'fixed', bottom: 0, left: 0, right: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 24px', background: '#fff',
  borderTop: '1px solid var(--color-border)', zIndex: 40,
};

const backBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid var(--color-border)',
  borderRadius: 8, padding: '8px 16px', fontSize: 13,
  fontWeight: 500, cursor: 'pointer', color: 'var(--color-text-primary)',
};
