import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Briefcase,
  AlertTriangle,
  FileText,
  DollarSign,
  Layers,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { getMyJobs, getMyBids } from '../../services/job.service';
import type { BidWithJob } from '../../services/job.service';
import { getEscrow } from '../../services/escrow.service';
import { fileDispute } from '../../services/dispute.service';
import type { DisputeCategory } from '../../types/dispute.types';
import type { JobPost } from '../../types/job.types';
import styles from './FileDisputePage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

const CATEGORY_OPTIONS: { value: DisputeCategory; label: string; description: string }[] = [
  { value: 'INCOMPLETE_WORK',        label: 'Incomplete Work',          description: 'Work was started but not finished' },
  { value: 'WORK_NOT_STARTED',       label: 'Work Not Started',         description: 'Contractor did not begin the job' },
  { value: 'QUALITY_ISSUES',         label: 'Quality Issues',           description: 'Work does not meet required standards' },
  { value: 'TIMELINE_BREACH',        label: 'Timeline Breach',          description: 'Work not completed by agreed deadline' },
  { value: 'PAYMENT_DISPUTE',        label: 'Payment Dispute',          description: 'Disagreement over payment amounts' },
  { value: 'SCOPE_CREEP',            label: 'Scope Creep',              description: 'Work expanded beyond original scope' },
  { value: 'COMMUNICATION_BREAKDOWN',label: 'Communication Breakdown',  description: 'Contractor became unresponsive' },
  { value: 'OTHER',                  label: 'Other',                    description: 'Another issue not listed above' },
];

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  OPEN:        { bg: '#DCFCE7', color: '#166534' },
  AWARDED:     { bg: '#DBEAFE', color: '#1E40AF' },
  IN_PROGRESS: { bg: '#FEF9C3', color: '#854D0E' },
  COMPLETED:   { bg: '#F3F4F6', color: '#374151' },
  CANCELLED:   { bg: '#FEE2E2', color: '#991B1B' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCategory(c: string) {
  return c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Select Job', 'Describe Issue', 'Review & Submit'];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className={styles.stepIndicator}>
      {STEPS.map((label, i) => {
        const num   = (i + 1) as Step;
        const done  = num < current;
        const active = num === current;
        return (
          <React.Fragment key={num}>
            <div className={styles.step}>
              <div
                className={[
                  styles.stepCircle,
                  done   ? styles.stepDone   : '',
                  active ? styles.stepActive : '',
                ].join(' ')}
              >
                {done ? <CheckCircle2 size={14} strokeWidth={2.5} /> : num}
              </div>
              <span
                className={[
                  styles.stepLabel,
                  active ? styles.stepLabelActive : '',
                  done   ? styles.stepLabelDone   : '',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={[styles.stepLine, done ? styles.stepLineDone : ''].join(' ')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Job selection card ────────────────────────────────────────────────────────

interface JobOption {
  jobId:   string;
  title:   string;
  status:  string;
  amount:  number;
  city:    string;
  state:   string;
  otherParty: string;
}

function JobCard({
  option,
  selected,
  onClick,
}: {
  option:   JobOption;
  selected: boolean;
  onClick:  () => void;
}) {
  const badge = STATUS_BADGE[option.status] ?? { bg: '#F3F4F6', color: '#374151' };
  return (
    <div
      className={[styles.jobCard, selected ? styles.jobCardSelected : ''].join(' ')}
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className={styles.jobCardTop}>
        <span className={styles.jobCardTitle}>{option.title}</span>
        <span
          className={styles.jobCardBadge}
          style={{ background: badge.bg, color: badge.color }}
        >
          {formatStatus(option.status)}
        </span>
      </div>
      <div className={styles.jobCardMeta}>
        <span>{option.city}, {option.state}</span>
        <span>•</span>
        <span>${option.amount.toLocaleString()}</span>
        <span>•</span>
        <span>{option.otherParty}</span>
      </div>
      {selected && (
        <div className={styles.jobCardCheck}>
          <CheckCircle2 size={16} strokeWidth={2.5} />
          Selected
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function FileDisputePage() {
  const { user }           = useAuth();
  const { toast }          = useToast();
  const navigate           = useNavigate();
  const queryClient        = useQueryClient();
  const [searchParams]     = useSearchParams();

  const isInvestor = user?.role === 'INVESTOR';

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep]                   = useState<Step>(1);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedBidAmount, setSelectedBidAmount] = useState<number>(0);

  // Step 2 state
  const [category, setCategory]           = useState<DisputeCategory | ''>('');
  const [amountDisputed, setAmountDisputed] = useState<string>('');
  const [milestoneDraw, setMilestoneDraw] = useState<string>('');
  const [description, setDescription]     = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');

  // ── Job data ──────────────────────────────────────────────────────────────
  const { data: myJobs, isLoading: jobsLoading } = useQuery({
    queryKey:  ['jobs', 'my-jobs'],
    queryFn:   getMyJobs,
    enabled:   isInvestor,
    staleTime: 30_000,
  });

  const { data: myBids, isLoading: bidsLoading } = useQuery({
    queryKey:  ['bids', 'my-bids'],
    queryFn:   getMyBids,
    enabled:   !isInvestor,
    staleTime: 30_000,
  });

  // ── Escrow for milestones ─────────────────────────────────────────────────
  const { data: escrow } = useQuery({
    queryKey:  ['escrow', selectedJobId],
    queryFn:   () => getEscrow(selectedJobId),
    enabled:   !!selectedJobId,
    retry:     false,
    staleTime: 60_000,
  });

  const milestones = escrow?.milestones.slice().sort((a, b) => a.order - b.order) ?? [];

  // ── Build job options ─────────────────────────────────────────────────────
  const jobOptions: JobOption[] = isInvestor
    ? (myJobs ?? [])
        .filter((j) => j.status === 'IN_PROGRESS' || j.status === 'AWARDED')
        .map((j) => ({
          jobId:      j.id,
          title:      j.title,
          status:     j.status,
          amount:     j.budgetMin,
          city:       j.city,
          state:      j.state,
          otherParty: 'Contractor',
        }))
    : (myBids ?? [])
        .filter((b): b is BidWithJob & { job: NonNullable<BidWithJob['job']> } =>
          b.status === 'ACCEPTED' && b.job !== null,
        )
        .map((b) => ({
          jobId:      b.job.id,
          title:      b.job.title,
          status:     b.job.status,
          amount:     b.amount,
          city:       b.job.city,
          state:      b.job.state,
          otherParty: `${b.job.investor.firstName} ${b.job.investor.lastName}`,
        }));

  // ── Pre-fill from ?jobId= ─────────────────────────────────────────────────
  // When a jobId is in the query string (e.g. from the "File a Dispute" link on
  // JobDetailPage), pre-select that job and skip directly to Step 2.
  useEffect(() => {
    const prefillId = searchParams.get('jobId');
    if (prefillId && jobOptions.length > 0) {
      const match = jobOptions.find((o) => o.jobId === prefillId);
      if (match) {
        setSelectedJobId(match.jobId);
        setSelectedBidAmount(match.amount);
        setAmountDisputed(String(match.amount));
        setStep(2);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobOptions.length, searchParams]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () =>
      fileDispute({
        jobId:          selectedJobId,
        milestoneDraw:  milestoneDraw ? Number(milestoneDraw) : undefined,
        amountDisputed: Number(amountDisputed),
        category:       category as DisputeCategory,
        description,
        desiredOutcome,
      }),
    onSuccess: (dispute) => {
      queryClient.invalidateQueries({ queryKey: ['disputes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['disputes', 'summary'] });
      toast('Dispute filed successfully');
      navigate(`/dashboard/settings/disputes/${dispute.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? 'Failed to file dispute — please try again', 'error');
    },
  });

  // ── Step navigation ───────────────────────────────────────────────────────
  function handleSelectJob(option: JobOption) {
    setSelectedJobId(option.jobId);
    setSelectedBidAmount(option.amount);
    if (!amountDisputed) setAmountDisputed(String(option.amount));
  }

  function goToStep2() {
    if (!selectedJobId) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToStep3() {
    if (!category || !amountDisputed || !description || !desiredOutcome) return;
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const step2Valid =
    !!category &&
    !!amountDisputed &&
    Number(amountDisputed) > 0 &&
    description.trim().length >= 50 &&
    desiredOutcome.trim().length >= 20;

  const selectedJobOption = jobOptions.find((o) => o.jobId === selectedJobId);
  const isLoading         = isInvestor ? jobsLoading : bidsLoading;

  // ── Step 1: Select Job ────────────────────────────────────────────────────
  function renderStep1() {
    return (
      <div className={styles.stepContent}>
        <div className={styles.stepHeader}>
          <Briefcase size={22} className={styles.stepIcon} />
          <div>
            <h2 className={styles.stepTitle}>Select a Job</h2>
            <p className={styles.stepSubtitle}>
              Choose the job this dispute relates to
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className={styles.jobList}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.jobCardSkeleton} />
            ))}
          </div>
        ) : jobOptions.length === 0 ? (
          <div className={styles.emptyState}>
            <AlertTriangle size={36} strokeWidth={1.5} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No eligible jobs found</p>
            <p className={styles.emptySub}>
              You can only file a dispute on jobs that are actively in progress or awarded.
            </p>
            <Link to="/dashboard/jobs" className={styles.emptyLink}>
              View my jobs →
            </Link>
          </div>
        ) : (
          <div className={styles.jobList} role="radiogroup" aria-label="Select a job">
            {jobOptions.map((option) => (
              <JobCard
                key={option.jobId}
                option={option}
                selected={selectedJobId === option.jobId}
                onClick={() => handleSelectJob(option)}
              />
            ))}
          </div>
        )}

        <div className={styles.stepActions}>
          <Link to="/dashboard/settings/disputes" className={styles.cancelLink}>
            Cancel
          </Link>
          <Button
            variant="primary"
            onClick={goToStep2}
            disabled={!selectedJobId || isLoading}
          >
            Next: Describe Issue
            <ChevronRight size={16} strokeWidth={2.5} style={{ marginLeft: 4 }} />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2: Describe Issue ────────────────────────────────────────────────
  function renderStep2() {
    return (
      <div className={styles.stepContent}>
        <div className={styles.stepHeader}>
          <AlertTriangle size={22} className={styles.stepIcon} />
          <div>
            <h2 className={styles.stepTitle}>Describe the Issue</h2>
            <p className={styles.stepSubtitle}>
              Provide details about the dispute for{' '}
              <strong>{selectedJobOption?.title}</strong>
            </p>
          </div>
        </div>

        {/* Category */}
        <div className={styles.field}>
          <label className={styles.label}>Dispute Category <span className={styles.required}>*</span></label>
          <div className={styles.categoryGrid}>
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.value}
                type="button"
                className={[
                  styles.categoryCard,
                  category === cat.value ? styles.categoryCardSelected : '',
                ].join(' ')}
                onClick={() => setCategory(cat.value)}
              >
                <span className={styles.categoryLabel}>{cat.label}</span>
                <span className={styles.categoryDesc}>{cat.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount in Dispute */}
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="amount">
              Amount in Dispute ($) <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputWithIcon}>
              <DollarSign size={15} className={styles.inputIcon} />
              <input
                id="amount"
                type="number"
                min={1}
                step={1}
                className={styles.input}
                value={amountDisputed}
                onChange={(e) => setAmountDisputed(e.target.value)}
                placeholder={String(selectedBidAmount || 0)}
              />
            </div>
          </div>

          {/* Milestone Draw */}
          {milestones.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="milestone">
                Milestone Draw (optional)
              </label>
              <div className={styles.inputWithIcon}>
                <Layers size={15} className={styles.inputIcon} />
                <select
                  id="milestone"
                  className={[styles.input, styles.select].join(' ')}
                  value={milestoneDraw}
                  onChange={(e) => setMilestoneDraw(e.target.value)}
                >
                  <option value="">— None / Whole project —</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.order}>
                      Draw {m.order}: {m.title} (${m.amount.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="description">
            Description <span className={styles.required}>*</span>
            <span className={styles.charHint}>
              {description.trim().length}/50 min chars
            </span>
          </label>
          <textarea
            id="description"
            className={styles.textarea}
            rows={5}
            placeholder="Describe the issue in detail — what happened, when, and what evidence you have…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {description.trim().length > 0 && description.trim().length < 50 && (
            <p className={styles.fieldError}>Please provide at least 50 characters.</p>
          )}
        </div>

        {/* Desired Outcome */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="outcome">
            Desired Outcome <span className={styles.required}>*</span>
            <span className={styles.charHint}>
              {desiredOutcome.trim().length}/20 min chars
            </span>
          </label>
          <textarea
            id="outcome"
            className={styles.textarea}
            rows={3}
            placeholder="What resolution are you seeking? (e.g. full refund, work completion, partial payment)"
            value={desiredOutcome}
            onChange={(e) => setDesiredOutcome(e.target.value)}
          />
          {desiredOutcome.trim().length > 0 && desiredOutcome.trim().length < 20 && (
            <p className={styles.fieldError}>Please provide at least 20 characters.</p>
          )}
        </div>

        <div className={styles.stepActions}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => { setStep(1); window.scrollTo({ top: 0 }); }}
          >
            <ChevronLeft size={16} strokeWidth={2.5} style={{ marginRight: 2 }} />
            Back
          </button>
          <Button variant="primary" onClick={goToStep3} disabled={!step2Valid}>
            Review & Submit
            <ChevronRight size={16} strokeWidth={2.5} style={{ marginLeft: 4 }} />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 3: Review & Submit ───────────────────────────────────────────────
  function renderStep3() {
    const milestoneLabel = milestoneDraw
      ? milestones.find((m) => String(m.order) === milestoneDraw)?.title ?? `Draw ${milestoneDraw}`
      : null;

    return (
      <div className={styles.stepContent}>
        <div className={styles.stepHeader}>
          <FileText size={22} className={styles.stepIcon} />
          <div>
            <h2 className={styles.stepTitle}>Review Your Dispute</h2>
            <p className={styles.stepSubtitle}>
              Confirm the details before submitting. Once filed, the other party will be notified.
            </p>
          </div>
        </div>

        <div className={styles.reviewCard}>
          <div className={styles.reviewSection}>
            <div className={styles.reviewSectionHeader}>
              <span className={styles.reviewSectionTitle}>Job</span>
              <button
                type="button"
                className={styles.editLink}
                onClick={() => { setStep(1); window.scrollTo({ top: 0 }); }}
              >
                Edit
              </button>
            </div>
            <p className={styles.reviewValue}>{selectedJobOption?.title}</p>
            <p className={styles.reviewMeta}>
              {selectedJobOption?.city}, {selectedJobOption?.state}
              {' · '}
              {selectedJobOption ? formatStatus(selectedJobOption.status) : ''}
            </p>
          </div>

          <div className={styles.reviewDivider} />

          <div className={styles.reviewSection}>
            <div className={styles.reviewSectionHeader}>
              <span className={styles.reviewSectionTitle}>Issue Details</span>
              <button
                type="button"
                className={styles.editLink}
                onClick={() => { setStep(2); window.scrollTo({ top: 0 }); }}
              >
                Edit
              </button>
            </div>
            <div className={styles.reviewGrid}>
              <div className={styles.reviewItem}>
                <span className={styles.reviewItemLabel}>Category</span>
                <span className={styles.reviewItemValue}>
                  {category ? formatCategory(category) : '—'}
                </span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewItemLabel}>Amount in Dispute</span>
                <span className={[styles.reviewItemValue, styles.reviewAmount].join(' ')}>
                  ${Number(amountDisputed).toLocaleString()}
                </span>
              </div>
              {milestoneLabel && (
                <div className={styles.reviewItem}>
                  <span className={styles.reviewItemLabel}>Milestone Draw</span>
                  <span className={styles.reviewItemValue}>{milestoneLabel}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.reviewDivider} />

          <div className={styles.reviewSection}>
            <div className={styles.reviewSectionHeader}>
              <span className={styles.reviewSectionTitle}>Description</span>
            </div>
            <p className={styles.reviewBody}>{description}</p>
          </div>

          <div className={styles.reviewDivider} />

          <div className={styles.reviewSection}>
            <div className={styles.reviewSectionHeader}>
              <span className={styles.reviewSectionTitle}>Desired Outcome</span>
            </div>
            <p className={styles.reviewBody}>{desiredOutcome}</p>
          </div>
        </div>

        <p className={styles.disclaimer}>
          By submitting this dispute you agree that the information provided is accurate.
          False or misleading disputes may result in account restrictions.
        </p>

        <div className={styles.stepActions}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => { setStep(2); window.scrollTo({ top: 0 }); }}
          >
            <ChevronLeft size={16} strokeWidth={2.5} style={{ marginRight: 2 }} />
            Back
          </button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Filing Dispute…' : 'Submit Dispute'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.pageHeader}>
          <Link to="/dashboard/settings/disputes" className={styles.backLinkTop}>
            <ChevronLeft size={15} strokeWidth={2.5} />
            Disputes
          </Link>
          <h1 className={styles.pageTitle}>File a Dispute</h1>
        </div>

        <StepIndicator current={step} />

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
}
