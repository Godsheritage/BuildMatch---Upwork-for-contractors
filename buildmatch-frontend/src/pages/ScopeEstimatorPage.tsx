import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import JobMediaUploader from '../components/job/JobMediaUploader';
import { ScopeEstimatorPanel } from '../components/job/ScopeEstimatorPanel';
import type { ScopeEstimate } from '../components/job/ScopeEstimatorPanel';
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

// ── Page ──────────────────────────────────────────────────────────────────────

export function ScopeEstimatorPage() {
  const [photoUrls, setPhotoUrls]   = useState<string[]>([]);
  const [tradeType, setTradeType]   = useState('');
  const [city, setCity]             = useState('');
  const [state, setState]           = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_lastEstimate, setLastEstimate] = useState<ScopeEstimate | null>(null);

  const canEstimate =
    photoUrls.length > 0 && tradeType !== '' && city.trim() !== '' && state !== '';

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Sparkles size={20} strokeWidth={1.75} color="#7C3AED" />
        </div>
        <div>
          <h1 className={styles.title}>AI Scope Estimator</h1>
          <p className={styles.subtitle}>
            Upload photos of your project site and let AI estimate the scope, budget, and materials needed.
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className={styles.card}>
        <p className={styles.cardTitle}>Project Details</p>
        <p className={styles.cardSubtitle}>
          Tell us a bit about the project before uploading photos.
        </p>

        <div className={styles.fields}>
          {/* Trade type */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="tradeType">Trade Type</label>
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

          {/* City + State row */}
          <div className={styles.locationRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="city">City</label>
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
              <label className={styles.label} htmlFor="state">State</label>
              <select
                id="state"
                className={styles.select}
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="">Select state…</option>
                {US_STATES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Photo uploader card */}
      <div className={styles.card}>
        <JobMediaUploader onMediaChange={setPhotoUrls} />
      </div>

      {/* Estimator panel — shown only when all inputs are filled */}
      {canEstimate && (
        <ScopeEstimatorPanel
          photoUrls={photoUrls}
          tradeType={tradeType}
          city={city}
          state={state}
          onEstimateReceived={(est) => setLastEstimate(est)}
        />
      )}

      {/* Hint when inputs incomplete */}
      {!canEstimate && (
        <p className={styles.hint}>
          Fill in the trade type, city, state, and upload at least one photo to enable AI analysis.
        </p>
      )}
    </div>
  );
}
