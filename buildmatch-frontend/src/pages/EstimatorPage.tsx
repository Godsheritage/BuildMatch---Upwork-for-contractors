import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Check, Building2, Camera, ClipboardList, Eye, Sparkles,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { getProperty, type Property } from '../services/property.service';

// Step components (rendered inline below — will be extracted later if they grow)
import { Step1PropertyBasics }     from '../components/estimator/Step1PropertyBasics';
import { Step2PhotoCapture }       from '../components/estimator/Step2PhotoCapture';
import { EstimatorStep3Questions } from '../components/estimator/EstimatorStep3Questions';
import { EstimatorStep4Review }    from '../components/estimator/EstimatorStep4Review';
import { EstimatorStep5Results }   from '../components/estimator/EstimatorStep5Results';

// ── Wizard state ─────────────────────────────────────────────────────────────

export interface PhotoEntry {
  photoId:   string;
  url:       string;
  caption:   string;
  sortOrder: number;
}

export interface WizardProperty {
  id?:           string;
  addressLine1:  string;
  addressLine2:  string;
  city:          string;
  state:         string;
  zipCode:       string;
  propertyType:  string;
  yearBuilt:     string;
  sqftEstimate:  string;
  bedrooms:      string;
  bathrooms:     string;
  hasBasement:   boolean;
  hasGarage:     boolean;
  stories:       string;
}

export interface WizardState {
  currentStep:     1 | 2 | 3 | 4 | 5;
  property:        WizardProperty;
  photos:          Record<string, PhotoEntry[]>;
  answers:         Record<string, string>;
  estimateId?:     string;
  estimateStatus?: 'PROCESSING' | 'COMPLETE' | 'FAILED';
}

const INITIAL_PROPERTY: WizardProperty = {
  addressLine1: '', addressLine2: '', city: '', state: '', zipCode: '',
  propertyType: 'SINGLE_FAMILY', yearBuilt: '', sqftEstimate: '',
  bedrooms: '', bathrooms: '', hasBasement: false, hasGarage: false, stories: '1',
};

const INITIAL_STATE: WizardState = {
  currentStep: 1,
  property:    { ...INITIAL_PROPERTY },
  photos:      {},
  answers:     {},
};

// ── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: 'Property',  icon: Building2 },
  { n: 2, label: 'Photos',    icon: Camera },
  { n: 3, label: 'Details',   icon: ClipboardList },
  { n: 4, label: 'Review',    icon: Eye },
  { n: 5, label: 'Estimate',  icon: Sparkles },
] as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export function EstimatorPage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const { toast } = useToast();

  const [wizard, setWizard] = useState<WizardState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);

  // ── Prefill from URL ?propertyId= ────────────────────────────────────────

  useEffect(() => {
    const propertyId = params.get('propertyId');
    if (!propertyId) return;

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const p: Property = await getProperty(propertyId);
        if (cancelled) return;
        setWizard((prev) => ({
          ...prev,
          currentStep: 2,
          property: {
            id:           p.id,
            addressLine1: p.address_line1,
            addressLine2: p.address_line2 ?? '',
            city:         p.city,
            state:        p.state,
            zipCode:      p.zip_code,
            propertyType: p.property_type,
            yearBuilt:    p.year_built?.toString() ?? '',
            sqftEstimate: p.sqft_estimate?.toString() ?? '',
            bedrooms:     p.bedrooms?.toString() ?? '',
            bathrooms:    p.bathrooms?.toString() ?? '',
            hasBasement:  p.has_basement,
            hasGarage:    p.has_garage,
            stories:      p.stories?.toString() ?? '1',
          },
        }));
      } catch {
        if (!cancelled) toast('Could not load property.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params, toast]);

  // ── Navigation ───────────────────────────────────────────────────────────

  const goNext = useCallback((patch: Partial<WizardState>) => {
    setWizard((prev) => {
      const next = { ...prev, ...patch };
      if (next.currentStep < 5) {
        next.currentStep = (next.currentStep + 1) as WizardState['currentStep'];
      }
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setWizard((prev) => {
      if (prev.currentStep <= 1) return prev;
      return { ...prev, currentStep: (prev.currentStep - 1) as WizardState['currentStep'] };
    });
  }, []);

  const updateWizard = useCallback((patch: Partial<WizardState>) => {
    setWizard((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const { currentStep } = wizard;

  if (loading) {
    return (
      <div style={pageStyle}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center', padding: 60 }}>
          Loading property…
        </p>
      </div>
    );
  }

  return (
    <div style={pageStyle}>

      {/* ── Step indicator ──────────────────────────────────────────────── */}
      <StepIndicator currentStep={currentStep} />

      {/* ── Back button ─────────────────────────────────────────────────── */}
      {currentStep > 1 && currentStep < 5 && (
        <button type="button" onClick={goBack} style={backBtnStyle}>
          <ArrowLeft size={14} strokeWidth={2} />
          Back
        </button>
      )}

      {/* ── Active step ─────────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <Step1PropertyBasics
          state={wizard}
          onNext={(updated) => setWizard(updated)}
        />
      )}
      {currentStep === 2 && (
        <Step2PhotoCapture
          state={wizard}
          onNext={(updated) => setWizard(updated)}
          onBack={goBack}
        />
      )}
      {currentStep === 3 && (
        <EstimatorStep3Questions
          answers={wizard.answers}
          onNext={(answers) => goNext({ answers })}
        />
      )}
      {currentStep === 4 && (
        <EstimatorStep4Review
          wizard={wizard}
          onNext={(patch) => goNext(patch)}
          onUpdate={updateWizard}
        />
      )}
      {currentStep === 5 && (
        <EstimatorStep5Results
          wizard={wizard}
          onUpdate={updateWizard}
          onNewEstimate={() => navigate('/dashboard/scope-estimator')}
        />
      )}
    </div>
  );
}

// ── Step indicator component ─────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div style={indicatorWrap}>
      {STEPS.map(({ n, label }, i) => {
        const completed = n < currentStep;
        const active    = n === currentStep;

        return (
          <div key={n} style={{ display: 'contents' }}>
            {/* Connector line (between circles) */}
            {i > 0 && (
              <div style={{
                flex: 1, height: 2, alignSelf: 'center',
                background: completed ? 'var(--color-accent)' : 'var(--color-border)',
                transition: 'background 0.3s',
              }} />
            )}

            {/* Step circle + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600,
                transition: 'all 0.3s',
                ...(completed
                  ? { background: 'var(--color-accent)', color: '#fff' }
                  : active
                    ? { background: 'var(--color-primary)', color: '#fff' }
                    : { background: 'transparent', border: '2px solid var(--color-border)', color: 'var(--color-text-muted)' }
                ),
              }}>
                {completed ? <Check size={16} strokeWidth={2.5} /> : n}
              </div>

              {/* Label — full on desktop, only current on mobile */}
              <span style={{
                fontSize: 11, fontWeight: 500, letterSpacing: 0.3,
                color: active ? 'var(--color-primary)' : completed ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}
                className={active ? '' : 'hide-mobile'}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}

      {/* Inline style tag for mobile hide helper */}
      <style>{`
        @media (max-width: 600px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth:      780,
  margin:        '0 auto',
  padding:       '32px 24px 64px',
  display:       'flex',
  flexDirection: 'column',
  gap:           24,
};

const indicatorWrap: React.CSSProperties = {
  display:     'flex',
  alignItems:  'flex-start',
  gap:         0,
  padding:     '0 12px',
  marginBottom: 8,
};

const backBtnStyle: React.CSSProperties = {
  display:    'inline-flex',
  alignItems: 'center',
  gap:        6,
  background: 'none',
  border:     'none',
  cursor:     'pointer',
  fontSize:   13,
  fontWeight: 500,
  color:      'var(--color-text-muted)',
  padding:    0,
  width:      'fit-content',
};
