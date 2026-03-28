import { useState } from 'react';
import { Sparkles, Check, Wrench, MapPin, Camera } from 'lucide-react';
import JobMediaUploader from '../components/job/JobMediaUploader';
import { ScopeEstimatorPanel } from '../components/job/ScopeEstimatorPanel';
import styles from './ScopeEstimatorPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const TRADE_OPTIONS = [
  { value: 'GENERAL',     label: 'General'     },
  { value: 'ELECTRICAL',  label: 'Electrical'  },
  { value: 'PLUMBING',    label: 'Plumbing'    },
  { value: 'HVAC',        label: 'HVAC'        },
  { value: 'ROOFING',     label: 'Roofing'     },
  { value: 'FLOORING',    label: 'Flooring'    },
  { value: 'PAINTING',    label: 'Painting'    },
  { value: 'LANDSCAPING', label: 'Landscaping' },
  { value: 'DEMOLITION',  label: 'Demolition'  },
  { value: 'OTHER',       label: 'Other'       },
];

const US_STATES = [
  { value: 'AL', label: 'Alabama' },       { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },       { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },    { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },   { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },       { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },        { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },      { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },          { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },      { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },         { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },     { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },      { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },      { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },    { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },{ value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },          { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },        { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },         { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },       { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },    { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },     { value: 'WY', label: 'Wyoming' },
];

// ── How-it-works sidebar ───────────────────────────────────────────────────────

interface HowItWorksProps {
  tradeType:  string;
  city:       string;
  state:      string;
  photoCount: number;
}

function HowItWorksCard({ tradeType, city, state, photoCount }: HowItWorksProps) {
  const steps = [
    {
      icon:  Wrench,
      title: 'Select trade type',
      desc:  'Pick the category of work needed',
      done:  tradeType !== '',
    },
    {
      icon:  MapPin,
      title: 'Enter location',
      desc:  'City and state for local pricing data',
      done:  city.trim() !== '' && state !== '',
    },
    {
      icon:  Camera,
      title: 'Upload photos',
      desc:  '1–5 photos of the project area',
      done:  photoCount > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className={styles.howCard}>
      <div className={styles.howHeader}>
        <Sparkles size={13} color="#7C3AED" strokeWidth={1.75} />
        <span className={styles.howHeaderText}>How it works</span>
      </div>

      <div className={styles.steps}>
        {steps.map(({ icon: Icon, title, desc, done }, i) => (
          <div key={i} className={styles.step}>
            <div className={`${styles.stepBubble} ${done ? styles.stepBubbleDone : ''}`}>
              {done
                ? <Check size={11} strokeWidth={2.5} />
                : <Icon size={12} strokeWidth={1.75} />
              }
            </div>
            <div className={styles.stepContent}>
              <p className={`${styles.stepTitle} ${done ? styles.stepTitleDone : ''}`}>{title}</p>
              <p className={styles.stepDesc}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress indicator */}
      <div className={styles.howProgress}>
        <div className={styles.howProgressTrack}>
          <div
            className={styles.howProgressFill}
            style={{ width: `${(doneCount / 3) * 100}%` }}
          />
        </div>
        <span className={styles.howProgressLabel}>{doneCount} of 3 complete</span>
      </div>

      <div className={styles.howDivider} />

      <p className={styles.howFooter}>
        Once all three steps are complete, AI will analyze your photos and return a budget estimate calibrated to your location.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ScopeEstimatorPage() {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [tradeType, setTradeType] = useState('');
  const [city,      setCity]      = useState('');
  const [state,     setState]     = useState('');

  const canEstimate =
    photoUrls.length > 0 && tradeType !== '' && city.trim() !== '' && state !== '';

  return (
    <div className={styles.page}>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.aiBadge}>
          <Sparkles size={12} color="#7C3AED" strokeWidth={1.75} />
          <span>Powered by AI</span>
        </div>
        <h1 className={styles.pageTitle}>Scope Estimator</h1>
        <p className={styles.pageSubtitle}>
          Upload project photos and get an instant AI-powered cost estimate — scope, materials, and budget range included.
        </p>
      </div>

      {/* ── Two-column body ───────────────────────────────────────────────── */}
      <div className={styles.body}>

        {/* Left column — form + uploader */}
        <div className={styles.leftCol}>

          {/* Section 01 — Project Details */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNum}>01</span>
              <span className={styles.sectionLabel}>Project Details</span>
            </div>
            <div className={styles.card}>
              <div className={styles.fields}>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="tradeType">Trade Type</label>
                  <select
                    id="tradeType"
                    className={styles.select}
                    value={tradeType}
                    onChange={(e) => setTradeType(e.target.value)}
                  >
                    <option value="">Select trade type…</option>
                    {TRADE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.locationRow}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="city">City</label>
                    <input
                      id="city"
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Austin"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel} htmlFor="state">State</label>
                    <select
                      id="state"
                      className={styles.select}
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    >
                      <option value="">State…</option>
                      {US_STATES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Section 02 — Photos */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNum}>02</span>
              <span className={styles.sectionLabel}>Project Photos</span>
            </div>
            <div className={styles.card}>
              <JobMediaUploader onMediaChange={setPhotoUrls} />
            </div>
          </div>

        </div>

        {/* Right column — how-it-works or estimator panel */}
        <div className={styles.rightCol}>
          {canEstimate ? (
            <ScopeEstimatorPanel
              photoUrls={photoUrls}
              tradeType={tradeType}
              city={city}
              state={state}
              onEstimateReceived={() => {}}
            />
          ) : (
            <HowItWorksCard
              tradeType={tradeType}
              city={city}
              state={state}
              photoCount={photoUrls.length}
            />
          )}
        </div>

      </div>
    </div>
  );
}
