import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Zap, Droplets, Wind, Home as HomeIcon, Layers, Paintbrush,
  Trees, Hammer, Wrench, Building2, ChevronDown,
  MapPin, Info, Lightbulb, DollarSign, Camera,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { createJob } from '../services/job.service';
import { classifyPreview, parseJobDescription } from '../services/ai.service';
import { useToast } from '../context/ToastContext';
import { useLang } from '../context/LanguageContext';
import JobMediaUploader from '../components/job/JobMediaUploader';
import { ScopeEstimatorPanel } from '../components/job/ScopeEstimatorPanel';
import { AiAssistedBadge } from '../components/job/JobDescriptionAssistant';
import type { TradeType, CreateJobPayload } from '../types/job.types';
import styles from './PostJobPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const TRADE_OPTIONS: {
  value: TradeType;
  icon: React.ElementType;
  color: string;
}[] = [
  { value: 'GENERAL',     icon: Building2,  color: '#1D4ED8' },
  { value: 'ELECTRICAL',  icon: Zap,        color: '#854D0E' },
  { value: 'PLUMBING',    icon: Droplets,   color: '#0369A1' },
  { value: 'HVAC',        icon: Wind,       color: '#0F766E' },
  { value: 'ROOFING',     icon: HomeIcon,   color: '#166534' },
  { value: 'FLOORING',    icon: Layers,     color: '#7E22CE' },
  { value: 'PAINTING',    icon: Paintbrush, color: '#C2410C' },
  { value: 'LANDSCAPING', icon: Trees,      color: '#15803D' },
  { value: 'DEMOLITION',  icon: Hammer,     color: '#B91C1C' },
  { value: 'OTHER',       icon: Wrench,     color: '#6B6B67' },
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
  title: '', tradeType: '', description: '',
  budgetMin: '', budgetMax: '', city: '', state: '', zipCode: '',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TradeTypeSelect({
  value,
  onChange,
  error,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder: string;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = TRADE_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
            <span style={{ flex: 1 }}>
              {t.specialties[selected.value as keyof typeof t.specialties] ?? selected.value}
            </span>
          </>
        ) : (
          <span className={styles.selectPlaceholder} style={{ flex: 1 }}>{placeholder}</span>
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
            const label = t.specialties[opt.value as keyof typeof t.specialties] ?? opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={[styles.selectOption, isActive ? styles.selectOptionActive : ''].join(' ')}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                <Icon size={14} color={opt.color} strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}

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

function JobPreviewCard({ form, photoUrls }: { form: FormValues; photoUrls: string[] }) {
  const { t } = useLang();
  const trade    = TRADE_OPTIONS.find((o) => o.value === form.tradeType);
  const tradeLabel = trade
    ? (t.specialties[trade.value as keyof typeof t.specialties] ?? trade.value)
    : null;
  const location = [form.city, form.state].filter(Boolean).join(', ');
  const min = parseFloat(form.budgetMin);
  const max = parseFloat(form.budgetMax);
  const hasBudget = !isNaN(min) && !isNaN(max) && min > 0 && max > 0;
  const hasTitle  = form.title.length >= 3;
  const hasDesc   = form.description.length >= 10;
  const heroPhoto = photoUrls[0];

  return (
    <div className={styles.previewCard}>
      {heroPhoto && (
        <div style={{ position: 'relative', margin: '-20px -20px 16px', overflow: 'hidden', borderRadius: '11px 11px 0 0' }}>
          <img
            src={heroPhoto}
            alt="Job preview"
            loading="lazy"
            style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
          />
          {photoUrls.length > 1 && (
            <span style={{
              position: 'absolute', bottom: 8, right: 8,
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 500,
              background: 'rgba(0,0,0,0.55)', color: '#fff',
              padding: '3px 8px', borderRadius: 'var(--radius-pill)',
            }}>
              <Camera size={11} strokeWidth={2} />
              {photoUrls.length}
            </span>
          )}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 4,
            color: hasTitle ? 'var(--color-text-primary)' : 'var(--color-border)',
          }}>
            {hasTitle ? form.title : t.postJob.preview.titlePH}
          </p>
          {location ? (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <MapPin size={11} strokeWidth={2} />
              {location}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--color-border)' }}>{t.postJob.preview.locationPH}</p>
          )}
        </div>
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 500,
          padding: '3px 10px', borderRadius: 'var(--radius-pill)',
          background: 'var(--color-highlight)', color: 'var(--color-accent)',
        }}>
          {t.status.OPEN}
        </span>
      </div>

      {trade && tradeLabel && (
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
            {tradeLabel}
          </span>
        </div>
      )}

      {hasDesc ? (
        <p style={{
          fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 14,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {form.description}
        </p>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--color-border)', lineHeight: 1.6, marginBottom: 14 }}>
          {t.postJob.preview.descPH}
        </p>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        paddingTop: 12, borderTop: '1px solid var(--color-border)', fontSize: 13,
      }}>
        {hasBudget ? (
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
            ${min.toLocaleString()}–${max.toLocaleString()}
          </span>
        ) : (
          <span style={{ color: 'var(--color-border)' }}>$0–$0</span>
        )}
        <span style={{ color: 'var(--color-text-muted)' }}>{t.postJob.preview.bids}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-muted)' }}>{t.postJob.preview.justNow}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PostJobPage() {
  const navigate   = useNavigate();
  const { toast }  = useToast();
  const { t }      = useLang();
  const [searchParams] = useSearchParams();

  // ── Stage management ────────────────────────────────────────────────────────
  const [stage, setStage]                   = useState<'describe' | 'form'>('describe');
  const [rawDescription, setRawDescription] = useState('');
  const [parseError, setParseError]         = useState<string | null>(null);

  const parseMutation = useMutation({
    mutationFn: (text: string) => parseJobDescription(text),
    onSuccess: (data) => {
      setForm({
        title:       data.title       ?? '',
        tradeType:   data.tradeType   ?? '',
        description: data.description ?? rawDescription,
        budgetMin:   data.budgetMin   != null ? String(Math.round(data.budgetMin)) : '',
        budgetMax:   data.budgetMax   != null ? String(Math.round(data.budgetMax)) : '',
        city:        data.city        ?? '',
        state:       data.state       ?? '',
        zipCode:     data.zipCode     ?? '',
      });
      setAiAssisted(true);
      setParseError(null);
      setStage('form');
    },
    onError: () => {
      setParseError('AI parsing failed — you can still fill in the form manually.');
      setStage('form');
    },
  });

  function handleAnalyze() {
    const text = rawDescription.trim();
    if (text.length < 20) {
      setParseError('Please describe your project in at least 20 characters.');
      return;
    }
    setParseError(null);
    parseMutation.mutate(text);
  }

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm]     = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);
  const [aiHint, setAiHint]           = useState<string | null>(null);
  const [aiAssisted, setAiAssisted]   = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [estimateCallout, setEstimateCallout] = useState<{ address: string; estimateId: string } | null>(null);
  const classifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Estimate pre-fill ─────────────────────────────────────────────────────
  useEffect(() => {
    const estimateId = searchParams.get('estimateId');
    if (!estimateId) return;
    let cancelled = false;
    (async () => {
      try {
        // Fetch full estimate
        const estRes = await import('../services/api').then(m => m.default.get<{
          success: boolean;
          data: {
            id: string; property_id: string; status: string;
            total_low: number | null; total_high: number | null;
            ai_summary: string | null;
            line_items: Array<{ category: string; label: string; scopeRecommended: string; amountHigh: number }> | null;
            renovation_purpose: string; primary_issue: string;
          };
        }>(`/estimator/estimates/${estimateId}`));
        const est = estRes.data.data;
        if (cancelled || est.status !== 'COMPLETE') return;

        // Fetch property
        const propRes = await import('../services/api').then(m => m.default.get<{
          success: boolean;
          data: { address_line1: string; city: string; state: string; zip_code: string };
        }>(`/properties/${est.property_id}`));
        const prop = propRes.data.data;
        if (cancelled) return;

        // Fetch estimate photos
        const photosRes = await import('../services/api').then(m => m.default.get<{
          success: boolean;
          data: Array<{ url: string }>;
        }>(`/estimator/estimates/${estimateId}/photos`));
        if (cancelled) return;

        // Build description
        const lineItems = est.line_items ?? [];
        const scopeLines = lineItems
          .filter(i => i.amountHigh > 0)
          .map(i => `- ${i.label}: ${i.scopeRecommended}`);
        const description =
          (est.ai_summary ?? '') +
          (scopeLines.length > 0 ? '\n\nScope of Work:\n' + scopeLines.join('\n') : '') +
          `\n\nBudget Estimate: $${(est.total_low ?? 0).toLocaleString()} - $${(est.total_high ?? 0).toLocaleString()}`;

        // Determine trade type from biggest line item category
        const tradeType = inferTradeType(lineItems, est.primary_issue);

        setForm({
          title:       `Renovation at ${prop.address_line1}`,
          tradeType,
          description: description.trim(),
          budgetMin:   est.total_low  != null ? String(Math.round(est.total_low))  : '',
          budgetMax:   est.total_high != null ? String(Math.round(est.total_high)) : '',
          city:        prop.city,
          state:       prop.state,
          zipCode:     prop.zip_code,
        });

        // Pre-populate photos
        const urls = (photosRes.data.data ?? []).map(p => p.url);
        if (urls.length > 0) setPhotoUrls(urls);

        setEstimateCallout({ address: `${prop.address_line1}, ${prop.city}, ${prop.state}`, estimateId });
        setStage('form');
      } catch {
        // Non-fatal — just don't prefill
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  function inferTradeType(
    lineItems: Array<{ category: string; amountHigh: number }>,
    primaryIssue: string,
  ): string {
    if (primaryIssue === 'FULL_GUT' || primaryIssue === 'NEGLECT') return 'GENERAL';
    if (primaryIssue === 'FIRE_DAMAGE') return 'GENERAL';
    if (primaryIssue === 'WATER_DAMAGE') return 'PLUMBING';

    // Find biggest cost category
    const catTotals = new Map<string, number>();
    for (const item of lineItems) {
      const cat = item.category.toUpperCase();
      catTotals.set(cat, (catTotals.get(cat) ?? 0) + item.amountHigh);
    }
    let biggest = '';
    let biggestVal = 0;
    for (const [cat, val] of catTotals) {
      if (val > biggestVal) { biggest = cat; biggestVal = val; }
    }

    const mapping: Record<string, string> = {
      KITCHEN: 'GENERAL', BATHROOM: 'PLUMBING', ROOF: 'ROOFING',
      ROOFING: 'ROOFING', ELECTRICAL: 'ELECTRICAL', PLUMBING: 'PLUMBING',
      HVAC: 'HVAC', FLOORING: 'FLOORING', PAINTING: 'PAINTING',
      DEMOLITION: 'DEMOLITION', LANDSCAPING: 'LANDSCAPING',
      SIDING: 'GENERAL', FOUNDATION: 'GENERAL', WINDOWS: 'GENERAL',
    };
    return mapping[biggest] ?? 'GENERAL';
  }

  useEffect(() => {
    if (classifyTimer.current) clearTimeout(classifyTimer.current);
    if (form.title.length >= 10 && form.description.length >= 50) {
      classifyTimer.current = setTimeout(async () => {
        try {
          const { suggestedTradeType } = await classifyPreview(form.title, form.description);
          if (suggestedTradeType && suggestedTradeType !== form.tradeType) {
            setAiHint(suggestedTradeType);
          } else {
            setAiHint(null);
          }
        } catch {
          // silently ignore classification errors
        }
      }, 1000);
    } else {
      setAiHint(null);
    }
    return () => {
      if (classifyTimer.current) clearTimeout(classifyTimer.current);
    };
  }, [form.title, form.description, form.tradeType]);

  function validate(form: FormValues): FormErrors {
    const errs: FormErrors = {};
    if (form.title.length < 10)        errs.title = t.postJob.validation.titleMin;
    else if (form.title.length > 120)  errs.title = t.postJob.validation.titleMax;
    if (!form.tradeType) errs.tradeType = t.postJob.validation.tradeRequired;
    if (form.description.length < 50)        errs.description = t.postJob.validation.descMin;
    else if (form.description.length > 2000) errs.description = t.postJob.validation.descMax;
    const min = parseFloat(form.budgetMin);
    const max = parseFloat(form.budgetMax);
    if (!form.budgetMin || isNaN(min) || min <= 0) errs.budgetMin = t.postJob.validation.minBudget;
    if (!form.budgetMax || isNaN(max) || max <= 0) errs.budgetMax = t.postJob.validation.maxBudget;
    if (!errs.budgetMin && !errs.budgetMax && min >= max) errs.budgetMin = t.postJob.validation.budgetOrder;
    if (!form.city.trim())    errs.city    = t.postJob.validation.cityRequired;
    if (!form.state)          errs.state   = t.postJob.validation.stateRequired;
    if (!form.zipCode.trim()) errs.zipCode = t.postJob.validation.zipRequired;
    return errs;
  }

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
      toast(t.postJob.toast.success);
      navigate('/dashboard/jobs');
    },
    onError: () => {
      toast(t.postJob.toast.error, 'error');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
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
      photoUrls:   photoUrls.length > 0 ? photoUrls : undefined,
    });
  }

  const tradeMeta    = TRADE_OPTIONS.find((o) => o.value === form.tradeType);
  const tradeLabel   = tradeMeta
    ? (t.specialties[tradeMeta.value as keyof typeof t.specialties] ?? tradeMeta.value)
    : null;
  const budgetRange  = form.tradeType ? BUDGET_GUIDE[form.tradeType as TradeType] : null;

  // ── Stage 1: Describe ────────────────────────────────────────────────────────
  if (stage === 'describe') {
    return (
      <div className={styles.page}>
        <div className={styles.describeContainer}>
          <div className={styles.describeCard}>
            <div className={styles.describeAiBadge}>
              <span className={styles.describeAiDot} />
              AI-powered
            </div>
            <h1 className={styles.describeHeading}>What do you need done?</h1>
            <p className={styles.describeSub}>
              Describe your project in plain language. AI will read it and pre-fill the job form for you.
            </p>

            <div className={styles.tipRow}>
              <span className={styles.tipRowLabel}>Tips:</span>
              {[
                {
                  icon: '📍',
                  label: 'Location',
                  body: 'Include the city and state so AI can set your location automatically.',
                  example: '"…in Dallas, TX"',
                },
                {
                  icon: '🔨',
                  label: 'Type of work',
                  body: 'Name the trade so AI can select the right category for you.',
                  example: '"roof repair", "HVAC install", "kitchen remodel"',
                },
                {
                  icon: '💰',
                  label: 'Budget',
                  body: 'A range or rough estimate helps AI pre-fill your budget fields.',
                  example: '"around $10,000–$15,000"',
                },
                {
                  icon: '🏠',
                  label: 'Property type',
                  body: 'Describing the property gives contractors helpful context.',
                  example: '"3-bed rental", "commercial unit", "duplex"',
                },
                {
                  icon: '📋',
                  label: 'Scope of work',
                  body: 'List the specific tasks so the description is ready to post.',
                  example: '"replace cabinets, countertops, and flooring"',
                },
                {
                  icon: '📅',
                  label: 'Timeline',
                  body: 'Mention urgency or a start date so contractors can plan.',
                  example: '"needs to start within 2 weeks"',
                },
              ].map((tip) => (
                <div key={tip.label} className={styles.tipChipWrap}>
                  <div className={styles.tipChip}>
                    <span>{tip.icon}</span>
                    {tip.label}
                  </div>
                  <div className={styles.tipPopup}>
                    <div className={styles.tipPopupArrow} />
                    <p className={styles.tipPopupTitle}>{tip.icon} {tip.label}</p>
                    <p className={styles.tipPopupBody}>{tip.body}</p>
                    <p className={styles.tipPopupExample}>{tip.example}</p>
                  </div>
                </div>
              ))}
            </div>

            <textarea
              className={styles.describeTextarea}
              rows={6}
              placeholder="e.g. I need to remodel a kitchen in my rental property in Austin, TX. Looking to replace cabinets, countertops, and flooring. Budget is around $15,000–$20,000."
              value={rawDescription}
              onChange={(e) => { setRawDescription(e.target.value); setParseError(null); }}
              autoFocus
            />

            <div className={styles.describeCharCount}>
              {rawDescription.length} / 1000
            </div>

            {parseError && (
              <p className={styles.describeError}>{parseError}</p>
            )}

            <div className={styles.describeActions}>
              <button
                className={styles.describeSkip}
                type="button"
                onClick={() => setStage('form')}
              >
                Skip — fill in manually
              </button>
              <button
                className={styles.describeBtn}
                type="button"
                onClick={handleAnalyze}
                disabled={parseMutation.isPending || rawDescription.trim().length < 20}
              >
                {parseMutation.isPending ? (
                  <>
                    <Spinner size="sm" />
                    Analyzing…
                  </>
                ) : (
                  <>✦ Analyze &amp; Pre-fill Form</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Stage 2: Form ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── Page header ── */}
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderTop}>
            <button
              type="button"
              className={styles.backToDescribe}
              onClick={() => { setStage('describe'); setErrors({}); }}
            >
              ← Edit description
            </button>
            {aiAssisted && (
              <span className={styles.aiPrefilledBadge}>✦ Pre-filled by AI</span>
            )}
          </div>
          <h1 className={styles.heading}>{t.postJob.title}</h1>
          <p className={styles.subheading}>{t.postJob.subtitle}</p>
        </div>

        {/* ── Estimate pre-fill callout ── */}
        {estimateCallout && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 12, padding: '14px 18px', marginBottom: 16,
            background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10,
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#065F46', display: 'flex', alignItems: 'center', gap: 6 }}>
                ✓ Pre-filled from your property estimate
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#065F46' }}>
                at {estimateCallout.address}. Review and edit before posting.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEstimateCallout(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontSize: 16, padding: 4 }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Form card ── */}
        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.card}>

            {/* Section 1: Job Details */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t.postJob.sections.jobDetails}</p>

              <div className={styles.field} data-error={!!errors.title || undefined}>
                <div className={styles.fieldHeader}>
                  <label htmlFor="title" className={styles.label}>{t.postJob.labels.jobTitle}</label>
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
                  placeholder={t.postJob.placeholders.jobTitle}
                  className={[styles.input, errors.title ? styles.inputError : ''].join(' ')}
                />
                {errors.title && <p className={styles.errorMsg}>{errors.title}</p>}
              </div>

              <div className={styles.field} data-error={!!errors.tradeType || undefined}>
                <label className={styles.label}>{t.postJob.labels.tradeType}</label>
                <TradeTypeSelect
                  value={form.tradeType}
                  onChange={set('tradeType')}
                  error={errors.tradeType}
                  placeholder={t.postJob.placeholders.tradeType}
                />
              </div>

              <div className={styles.field} data-error={!!errors.description || undefined} style={{ marginBottom: 0 }}>
                <div className={styles.fieldHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label className={styles.label}>{t.postJob.labels.description}</label>
                    {aiAssisted && <AiAssistedBadge />}
                  </div>
                  <span className={[styles.charCount, form.description.length > 2000 ? styles.charCountOver : ''].join(' ')}>
                    {form.description.length}/2000
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={form.description}
                  onChange={set('description')}
                  placeholder={t.postJob.placeholders.description}
                  className={[styles.input, errors.description ? styles.inputError : ''].join(' ')}
                  style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                />
                {errors.description && <p className={styles.errorMsg}>{errors.description}</p>}
                {aiHint && (
                  <button
                    type="button"
                    className={styles.aiHintBadge}
                    onClick={() => {
                      set('tradeType')(aiHint);
                      setAiHint(null);
                    }}
                  >
                    ✦ AI suggests: {t.specialties[aiHint as keyof typeof t.specialties] ?? aiHint}
                  </button>
                )}
              </div>
            </div>

            {/* Section 2: Budget */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>{t.postJob.sections.budget}</p>

              <div className={styles.budgetGrid}>
                <div className={styles.field} data-error={!!errors.budgetMin || undefined} style={{ marginBottom: 0 }}>
                  <label htmlFor="budgetMin" className={styles.label}>{t.postJob.labels.minBudget}</label>
                  <MoneyInput
                    id="budgetMin"
                    value={form.budgetMin}
                    onChange={set('budgetMin')}
                    placeholder={t.postJob.placeholders.minBudget}
                    error={errors.budgetMin}
                  />
                </div>
                <div className={styles.field} data-error={!!errors.budgetMax || undefined} style={{ marginBottom: 0 }}>
                  <label htmlFor="budgetMax" className={styles.label}>{t.postJob.labels.maxBudget}</label>
                  <MoneyInput
                    id="budgetMax"
                    value={form.budgetMax}
                    onChange={set('budgetMax')}
                    placeholder={t.postJob.placeholders.maxBudget}
                    error={errors.budgetMax}
                  />
                </div>
              </div>

              <p className={styles.budgetHelper}>{t.postJob.helpers.budgetRange}</p>

              {budgetRange && tradeLabel && (
                <div className={styles.tipBox}>
                  <Lightbulb size={14} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    {t.postJob.helpers.budgetTip
                      .replace('{trade}', tradeLabel)
                      .replace('${min}', `$${budgetRange[0].toLocaleString()}`)
                      .replace('${max}', `$${budgetRange[1].toLocaleString()}`)
                    }
                  </span>
                </div>
              )}
            </div>

            {/* Section 3: Photos & Videos */}
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Photos &amp; Videos</p>
              <JobMediaUploader onMediaChange={(photos) => setPhotoUrls(photos)} />
              {photoUrls.length > 0 && !!form.tradeType && !!form.city && !!form.state && (
                <ScopeEstimatorPanel
                  photoUrls={photoUrls}
                  tradeType={form.tradeType}
                  city={form.city}
                  state={form.state}
                  onEstimateReceived={(estimate) => {
                    if (!form.description) {
                      set('description')(estimate.scopeItems.join('\n'));
                    }
                  }}
                  onApplyBudget={(low, high) => {
                    set('budgetMin')(String(low));
                    set('budgetMax')(String(high));
                  }}
                />
              )}
            </div>

            {/* Section 4: Location */}
            <div className={styles.section} style={{ borderBottom: 'none' }}>
              <p className={styles.sectionTitle}>{t.postJob.sections.location}</p>

              <div className={styles.locationGrid}>
                <div className={styles.field} data-error={!!errors.city || undefined} style={{ marginBottom: 0 }}>
                  <label htmlFor="city" className={styles.label}>{t.postJob.labels.city}</label>
                  <input
                    id="city"
                    type="text"
                    value={form.city}
                    onChange={set('city')}
                    placeholder={t.postJob.placeholders.city}
                    className={[styles.input, errors.city ? styles.inputError : ''].join(' ')}
                  />
                  {errors.city && <p className={styles.errorMsg}>{errors.city}</p>}
                </div>

                <div className={styles.field} data-error={!!errors.state || undefined} style={{ marginBottom: 0 }}>
                  <label htmlFor="state" className={styles.label}>{t.postJob.labels.state}</label>
                  <select
                    id="state"
                    value={form.state}
                    onChange={set('state')}
                    className={[styles.nativeSelect, errors.state ? styles.inputError : ''].join(' ')}
                  >
                    <option value="">{t.postJob.placeholders.state}</option>
                    {US_STATES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {errors.state && <p className={styles.errorMsg}>{errors.state}</p>}
                </div>
              </div>

              <div className={styles.field} data-error={!!errors.zipCode || undefined} style={{ marginTop: 14 }}>
                <label htmlFor="zipCode" className={styles.label}>{t.postJob.labels.zipCode}</label>
                <input
                  id="zipCode"
                  type="text"
                  value={form.zipCode}
                  onChange={set('zipCode')}
                  placeholder={t.postJob.placeholders.zipCode}
                  maxLength={10}
                  style={{ maxWidth: 200 }}
                  className={[styles.input, errors.zipCode ? styles.inputError : ''].join(' ')}
                />
                {errors.zipCode && <p className={styles.errorMsg}>{errors.zipCode}</p>}
              </div>

              <div className={styles.locationNote}>
                <Info size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
                {t.postJob.helpers.locationNote}
              </div>
            </div>
          </div>

          {/* ── Submit ── */}
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
                  {t.postJob.loading}
                </span>
              ) : (
                t.postJob.submit
              )}
            </Button>
          </div>
        </form>

        {/* ── Live preview ── */}
        <div className={styles.previewSection}>
          <p className={styles.previewLabel}>{t.postJob.preview.heading}</p>
          <JobPreviewCard form={form} photoUrls={photoUrls} />
        </div>

      </div>
    </div>
  );
}
