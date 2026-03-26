import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Droplets, Wind, Home as HomeIcon, Layers, Paintbrush,
  Trees, Hammer, Wrench, Building2, ChevronDown,
  MapPin, Info, Lightbulb, DollarSign,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { createJob } from '../services/job.service';
import { useToast } from '../context/ToastContext';
import type { TradeType, CreateJobPayload } from '../types/job.types';
import styles from './PostJobPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const TRADE_OPTIONS: {
  value: TradeType;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { value: 'GENERAL',     label: 'General Contractor', icon: Building2,  color: '#1D4ED8' },
  { value: 'ELECTRICAL',  label: 'Electrical',          icon: Zap,        color: '#854D0E' },
  { value: 'PLUMBING',    label: 'Plumbing',            icon: Droplets,   color: '#0369A1' },
  { value: 'HVAC',        label: 'HVAC',                icon: Wind,       color: '#0F766E' },
  { value: 'ROOFING',     label: 'Roofing',             icon: HomeIcon,   color: '#166534' },
  { value: 'FLOORING',    label: 'Flooring',            icon: Layers,     color: '#7E22CE' },
  { value: 'PAINTING',    label: 'Painting',            icon: Paintbrush, color: '#C2410C' },
  { value: 'LANDSCAPING', label: 'Landscaping',         icon: Trees,      color: '#15803D' },
  { value: 'DEMOLITION',  label: 'Demolition',          icon: Hammer,     color: '#B91C1C' },
  { value: 'OTHER',       label: 'Other Trade',         icon: Wrench,     color: '#6B6B67' },
];

const BUDGET_GUIDE: Record<TradeType, [number, number]> = {
  GENERAL:     [10000, 80000],
  ELECTRICAL:  [500,   5000],
  PLUMBING:    [300,   3000],
  HVAC:        [2000,  10000],
  ROOFING:     [5000,  25000],
  FLOORING:    [1500,  8000],
  PAINTING:    [800,   6000],
  LANDSCAPING: [500,   8000],
  DEMOLITION:  [2000,  15000],
  OTHER:       [500,   10000],
};

const US_STATES = [
  { value: 'AL', label: 'Alabama' },       { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },       { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },    { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },   { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'D.C.' },          { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },       { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },         { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },       { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },        { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },     { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },      { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },      { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },   { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },       { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },        { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },    { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },      { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },      { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },{ value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },     { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },          { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },      { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' }, { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// ── Form types ────────────────────────────────────────────────────────────────

interface FormValues {
  title:       string;
  tradeType:   string;
  description: string;
  budgetMin:   string;
  budgetMax:   string;
  city:        string;
  state:       string;
  zipCode:     string;
}

interface FormErrors {
  title?:       string;
  tradeType?:   string;
  description?: string;
  budgetMin?:   string;
  budgetMax?:   string;
  city?:        string;
  state?:       string;
  zipCode?:     string;
}

const EMPTY_FORM: FormValues = {
  title:       '',
  tradeType:   '',
  description: '',
  budgetMin:   '',
  budgetMax:   '',
  city:        '',
  state:       '',
  zipCode:     '',
};

// ── Sub-components ────────────────────────────────────────────────────────────

/** Custom dropdown with icons for trade type selection */
function TradeTypeSelect({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = TRADE_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={styles.selectWrapper}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[styles.selectTrigger, error ? styles.inputError : ''].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <selected.icon size={15} color={selected.color} strokeWidth={1.75} />
            <span style={{ flex: 1 }}>{selected.label}</span>
          </>
        ) : (
          <span className={styles.selectPlaceholder} style={{ flex: 1 }}>
            Select a trade type
          </span>
        )}
        <ChevronDown
          size={15}
          strokeWidth={2}
          className={[styles.chevron, open ? styles.chevronOpen : ''].join(' ')}
        />
      </button>

      {open && (
        <div className={styles.selectDropdown} role="listbox">
          {TRADE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={[styles.selectOption, isActive ? styles.selectOptionActive : ''].join(' ')}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                <Icon size={14} color={isActive ? opt.color : opt.color} strokeWidth={1.75} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}

/** Dollar-prefixed number input */
function MoneyInput({
  value,
  onChange,
  placeholder,
  error,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  id?: string;
}) {
  return (
    <div>
      <div className={[styles.inputGroup, error ? styles.inputError : ''].join(' ')}>
        <span className={styles.inputPrefix}>
          <DollarSign size={13} strokeWidth={2} />
        </span>
        <input
          id={id}
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={styles.inputGroupInput}
        />
      </div>
      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}

/** Live preview card shown below the form */
function JobPreviewCard({ form }: { form: FormValues }) {
  const trade   = TRADE_OPTIONS.find((o) => o.value === form.tradeType);
  const location = [form.city, form.state].filter(Boolean).join(', ');
  const min = parseFloat(form.budgetMin);
  const max = parseFloat(form.budgetMax);
  const hasBudget = !isNaN(min) && !isNaN(max) && min > 0 && max > 0;
  const hasTitle  = form.title.length >= 3;
  const hasDesc   = form.description.length >= 10;

  return (
    <div className={styles.previewCard}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 4,
            color: hasTitle ? 'var(--color-text-primary)' : 'var(--color-border)',
          }}>
            {hasTitle ? form.title : 'Your job title will appear here'}
          </p>
          {location ? (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <MapPin size={11} strokeWidth={2} />
              {location}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--color-border)' }}>City, State</p>
          )}
        </div>
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 500,
          padding: '3px 10px', borderRadius: 'var(--radius-pill)',
          background: 'var(--color-highlight)', color: 'var(--color-accent)',
        }}>
          Open
        </span>
      </div>

      {/* Trade badge */}
      {trade && (
        <div style={{ marginBottom: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 500, padding: '3px 10px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
          }}>
            <trade.icon size={11} color={trade.color} strokeWidth={1.75} />
            {trade.label}
          </span>
        </div>
      )}

      {/* Description */}
      {hasDesc ? (
        <p style={{
          fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6,
          marginBottom: 14,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {form.description}
        </p>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--color-border)', lineHeight: 1.6, marginBottom: 14 }}>
          Your job description will appear here…
        </p>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        paddingTop: 12, borderTop: '1px solid var(--color-border)',
        fontSize: 13,
      }}>
        {hasBudget ? (
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
            ${min.toLocaleString()}–${max.toLocaleString()}
          </span>
        ) : (
          <span style={{ color: 'var(--color-border)' }}>$0–$0</span>
        )}
        <span style={{ color: 'var(--color-text-muted)' }}>0 bids</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)' }}>Just now</span>
      </div>
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(form: FormValues): FormErrors {
  const errs: FormErrors = {};

  if (form.title.length < 10)        errs.title = 'Title must be at least 10 characters';
  else if (form.title.length > 120)  errs.title = 'Title must be at most 120 characters';

  if (!form.tradeType) errs.tradeType = 'Please select a trade type';

  if (form.description.length < 50)        errs.description = 'Description must be at least 50 characters';
  else if (form.description.length > 2000) errs.description = 'Description must be at most 2000 characters';

  const min = parseFloat(form.budgetMin);
  const max = parseFloat(form.budgetMax);
  if (!form.budgetMin || isNaN(min) || min <= 0) errs.budgetMin = 'Enter a valid minimum budget';
  if (!form.budgetMax || isNaN(max) || max <= 0) errs.budgetMax = 'Enter a valid maximum budget';
  if (!errs.budgetMin && !errs.budgetMax && min >= max) {
    errs.budgetMin = 'Minimum must be less than maximum';
  }

  if (!form.city.trim())    errs.city    = 'City is required';
  if (!form.state)          errs.state   = 'State is required';
  if (!form.zipCode.trim()) errs.zipCode = 'Zip code is required';

  return errs;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PostJobPage() {
  const navigate = useNavigate();
  const { toast }  = useToast();
  const [form, setForm]   = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);

  const set = (field: keyof FormValues) => (
    (v: string | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = typeof v === 'string' ? v : v.target.value;
      setForm((f) => ({ ...f, [field]: val }));
      if (touched) setErrors((e) => ({ ...e, [field]: undefined }));
    }
  );

  const mutation = useMutation({
    mutationFn: (payload: CreateJobPayload) => createJob(payload),
    onSuccess: (job) => {
      toast('Job posted! Contractors will start sending you bids soon.');
      navigate(`/dashboard/jobs/${job.id}`);
    },
    onError: () => {
      toast('Failed to post job. Please try again.', 'error');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Scroll to first error
      const firstField = document.querySelector('[data-error="true"]');
      firstField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setErrors({});
    mutation.mutate({
      title:       form.title,
      description: form.description,
      tradeType:   form.tradeType as TradeType,
      budgetMin:   parseFloat(form.budgetMin),
      budgetMax:   parseFloat(form.budgetMax),
      city:        form.city.trim(),
      state:       form.state,
      zipCode:     form.zipCode.trim(),
    });
  }

  const tradeMeta = TRADE_OPTIONS.find((o) => o.value === form.tradeType);
  const budgetRange = form.tradeType ? BUDGET_GUIDE[form.tradeType as TradeType] : null;

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── Page header ─────────────────────────────────── */}
        <div className={styles.pageHeader}>
          <h1 className={styles.heading}>Post a New Job</h1>
          <p className={styles.subheading}>
            Describe the work you need done and contractors will send you bids.
          </p>
        </div>

        {/* ── Form card ───────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.card}>

            {/* ── Section 1: Job Details ─────────────────── */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Job Details</p>

              {/* Title */}
              <div className={styles.field} data-error={!!errors.title || undefined}>
                <div className={styles.fieldHeader}>
                  <label htmlFor="title" className={styles.label}>Job title</label>
                  <span className={[styles.charCount, form.title.length > 120 ? styles.charCountOver : ''].join(' ')}>
                    {form.title.length}/120
                  </span>
                </div>
                <input
                  id="title"
                  type="text"
                  maxLength={140}
                  value={form.title}
                  onChange={set('title')}
                  placeholder="e.g., Full kitchen renovation for rental property"
                  className={[styles.input, errors.title ? styles.inputError : ''].join(' ')}
                />
                {errors.title && <p className={styles.errorMsg}>{errors.title}</p>}
              </div>

              {/* Trade type */}
              <div className={styles.field} data-error={!!errors.tradeType || undefined}>
                <label className={styles.label}>Trade type</label>
                <TradeTypeSelect
                  value={form.tradeType}
                  onChange={set('tradeType')}
                  error={errors.tradeType}
                />
              </div>

              {/* Description */}
              <div className={styles.field} data-error={!!errors.description || undefined} style={{ marginBottom: 0 }}>
                <div className={styles.fieldHeader}>
                  <label htmlFor="description" className={styles.label}>Description</label>
                  <span className={[styles.charCount, form.description.length > 2000 ? styles.charCountOver : ''].join(' ')}>
                    {form.description.length}/2000
                  </span>
                </div>
                <textarea
                  id="description"
                  rows={6}
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Describe the scope of work, materials, timeline, and any specific requirements..."
                  className={[styles.textarea, errors.description ? styles.inputError : ''].join(' ')}
                />
                {errors.description && <p className={styles.errorMsg}>{errors.description}</p>}
              </div>
            </div>

            {/* ── Section 2: Budget ──────────────────────── */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Budget</p>

              <div className={styles.budgetGrid}>
                <div className={styles.field} data-error={!!errors.budgetMin || undefined} style={{ marginBottom: 0 }}>
                  <label htmlFor="budgetMin" className={styles.label}>Minimum budget</label>
                  <MoneyInput
                    id="budgetMin"
                    value={form.budgetMin}
                    onChange={set('budgetMin')}
                    placeholder="1,000"
                    error={errors.budgetMin}
                  />
                </div>
                <div className={styles.field} data-error={!!errors.budgetMax || undefined} style={{ marginBottom: 0 }}>
                  <label htmlFor="budgetMax" className={styles.label}>Maximum budget</label>
                  <MoneyInput
                    id="budgetMax"
                    value={form.budgetMax}
                    onChange={set('budgetMax')}
                    placeholder="5,000"
                    error={errors.budgetMax}
                  />
                </div>
              </div>

              <p className={styles.budgetHelper}>
                Set a realistic range to attract quality bids
              </p>

              {/* Budget guide callout */}
              {budgetRange && (
                <div className={styles.tipBox}>
                  <Lightbulb size={14} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    <strong>Tip:</strong> Most {tradeMeta?.label} projects in your area range from{' '}
                    <strong>${budgetRange[0].toLocaleString()}–${budgetRange[1].toLocaleString()}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* ── Section 3: Location ────────────────────── */}
            <div className={styles.section} style={{ borderBottom: 'none' }}>
              <p className={styles.sectionTitle}>Location</p>

              <div className={styles.locationGrid}>
                {/* City */}
                <div className={styles.field} data-error={!!errors.city || undefined} style={{ marginBottom: 0 }}>
                  <label htmlFor="city" className={styles.label}>City</label>
                  <input
                    id="city"
                    type="text"
                    value={form.city}
                    onChange={set('city')}
                    placeholder="San Francisco"
                    className={[styles.input, errors.city ? styles.inputError : ''].join(' ')}
                  />
                  {errors.city && <p className={styles.errorMsg}>{errors.city}</p>}
                </div>

                {/* State */}
                <div className={styles.field} data-error={!!errors.state || undefined} style={{ marginBottom: 0 }}>
                  <label htmlFor="state" className={styles.label}>State</label>
                  <select
                    id="state"
                    value={form.state}
                    onChange={set('state')}
                    className={[styles.nativeSelect, errors.state ? styles.inputError : ''].join(' ')}
                  >
                    <option value="">Select state</option>
                    {US_STATES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {errors.state && <p className={styles.errorMsg}>{errors.state}</p>}
                </div>
              </div>

              {/* Zip code */}
              <div className={styles.field} data-error={!!errors.zipCode || undefined} style={{ marginTop: 14 }}>
                <label htmlFor="zipCode" className={styles.label}>Zip code</label>
                <input
                  id="zipCode"
                  type="text"
                  value={form.zipCode}
                  onChange={set('zipCode')}
                  placeholder="94103"
                  maxLength={10}
                  style={{ maxWidth: 200 }}
                  className={[styles.input, errors.zipCode ? styles.inputError : ''].join(' ')}
                />
                {errors.zipCode && <p className={styles.errorMsg}>{errors.zipCode}</p>}
              </div>

              {/* Privacy note */}
              <div className={styles.locationNote}>
                <Info size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
                Only your city and state will be shown to contractors publicly.
              </div>
            </div>
          </div>

          {/* ── Submit ──────────────────────────────────────── */}
          <div className={styles.submitRow}>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {mutation.isPending ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spinner size="sm" />
                  Posting job…
                </span>
              ) : (
                'Post Job'
              )}
            </Button>
          </div>
        </form>

        {/* ── Live preview ─────────────────────────────────── */}
        <div className={styles.previewSection}>
          <p className={styles.previewLabel}>Preview — how contractors will see your job</p>
          <JobPreviewCard form={form} />
        </div>

      </div>
    </div>
  );
}
