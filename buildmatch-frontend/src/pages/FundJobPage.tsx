import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  ChevronLeft, Plus, Trash2, Wand2, AlertCircle,
  CheckCircle2, DollarSign, Layers,
} from 'lucide-react';
import { getJobById, getJobBids } from '../services/job.service';
import { fundJob } from '../services/escrow.service';
import type { MilestoneInput, EscrowPayment } from '../services/escrow.service';
import { Button } from '../components/ui/Button';
import styles from './FundJobPage.module.css';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

// ── Auto-suggest helper (mirrors backend logic) ───────────────────────────────

function autoSuggest(amount: number): MilestoneInput[] {
  if (amount < 5_000) {
    return [{ title: 'Project completion', percentage: 100 }];
  }
  if (amount <= 20_000) {
    return [
      { title: 'Kickoff',   percentage: 25 },
      { title: 'Mid-point', percentage: 50 },
      { title: 'Final',     percentage: 25 },
    ];
  }
  return [
    { title: 'Kickoff',           percentage: 20 },
    { title: 'First milestone',   percentage: 30 },
    { title: 'Second milestone',  percentage: 30 },
    { title: 'Final',             percentage: 20 },
  ];
}

function newBlankMilestone(): MilestoneInput {
  return { title: '', percentage: 0 };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function FundJobPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate  = useNavigate();

  const { data: job, isLoading: jobLoading } = useQuery({
    queryKey: ['jobs', jobId],
    queryFn:  () => getJobById(jobId!),
    enabled:  !!jobId,
  });

  const { data: bids, isLoading: bidsLoading } = useQuery({
    queryKey: ['jobs', jobId, 'bids'],
    queryFn:  () => getJobBids(jobId!),
    enabled:  !!jobId && job?.status === 'AWARDED',
  });

  const acceptedBid = bids?.find((b) => b.status === 'ACCEPTED');

  // Step state
  const [step, setStep] = useState<'milestones' | 'payment' | 'success'>('milestones');
  const [milestones, setMilestones] = useState<MilestoneInput[]>([]);
  const [escrowResult, setEscrowResult] = useState<{ clientSecret: string; escrowPayment: EscrowPayment } | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPercent = milestones.reduce((s, m) => s + (m.percentage || 0), 0);
  const totalAmount  = acceptedBid?.amount ?? 0;

  const handleAutoSuggest = useCallback(() => {
    setMilestones(autoSuggest(totalAmount));
    setConfigError(null);
  }, [totalAmount]);

  const handleAddMilestone = () => {
    if (milestones.length >= 10) return;
    setMilestones((prev) => [...prev, newBlankMilestone()]);
  };

  const handleRemove = (i: number) => setMilestones((prev) => prev.filter((_, idx) => idx !== i));

  const handleChange = (i: number, field: keyof MilestoneInput, value: string | number) => {
    setMilestones((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const handleContinue = async () => {
    if (milestones.length === 0) { setConfigError('Add at least one milestone.'); return; }
    if (Math.abs(totalPercent - 100) > 0.01) { setConfigError('Percentages must sum to exactly 100%.'); return; }
    const invalid = milestones.find((m) => !m.title.trim());
    if (invalid) { setConfigError('All milestones must have a title.'); return; }

    setConfigError(null);
    setIsSubmitting(true);
    try {
      const result = await fundJob(jobId!, milestones);
      setEscrowResult(result);
      setStep('payment');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setConfigError(msg ?? 'Failed to create escrow. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (jobLoading || bidsLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeleton} style={{ height: i === 1 ? 80 : 140, marginBottom: 12 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.errorState}>
            <AlertCircle size={32} color="var(--color-danger)" strokeWidth={1.5} />
            <p>Job not found.</p>
            <Link to="/dashboard/jobs"><Button variant="secondary" size="sm">Back to jobs</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  if (job.status !== 'AWARDED') {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.errorState}>
            <AlertCircle size={32} color="var(--color-warning)" strokeWidth={1.5} />
            <p>This job cannot be funded yet — it must have an accepted bid first.</p>
            <Link to="/dashboard/jobs"><Button variant="secondary" size="sm">Back to jobs</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.successState}>
            <CheckCircle2 size={52} color="#0F6E56" strokeWidth={1.5} />
            <h2 className={styles.successTitle}>Escrow funded!</h2>
            <p className={styles.successBody}>
              Your payment is being processed. The contractor will be notified when the funds are confirmed.
            </p>
            <Button variant="primary" onClick={() => navigate('/dashboard/jobs')}>
              Back to my jobs
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const contractorName = acceptedBid?.contractor?.user
    ? `${acceptedBid.contractor.user.firstName} ${acceptedBid.contractor.user.lastName}`
    : 'Contractor';

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Back link */}
        <Link to="/dashboard/jobs" className={styles.backLink}>
          <ChevronLeft size={16} strokeWidth={2} /> Back to jobs
        </Link>

        {/* Page header */}
        <div className={styles.pageHeader}>
          <h1 className={styles.heading}>Fund Job Escrow</h1>
          <p className={styles.subheading}>
            Set up milestone-based payments for <strong>{job.title}</strong>.
          </p>
        </div>

        {/* Step indicator */}
        <div className={styles.steps}>
          <StepDot n={1} label="Set milestones" active={step === 'milestones'} done={step === 'payment'} />
          <div className={styles.stepLine} />
          <StepDot n={2} label="Payment"        active={step === 'payment'}    done={false} />
        </div>

        {/* Job summary */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Job</span>
              <span className={styles.summaryValue}>{job.title}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Contractor</span>
              <span className={styles.summaryValue}>{contractorName}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Awarded bid</span>
              <span className={`${styles.summaryValue} ${styles.summaryAmount}`}>
                ${totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Step 1: Milestone configuration */}
        {step === 'milestones' && (
          <MilestonesStep
            milestones={milestones}
            totalPercent={totalPercent}
            totalAmount={totalAmount}
            error={configError}
            isSubmitting={isSubmitting}
            onAutoSuggest={handleAutoSuggest}
            onAdd={handleAddMilestone}
            onRemove={handleRemove}
            onChange={handleChange}
            onContinue={handleContinue}
          />
        )}

        {/* Step 2: Stripe payment */}
        {step === 'payment' && escrowResult && (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret: escrowResult.clientSecret, appearance: { theme: 'stripe' } }}
          >
            <PaymentStep
              escrow={escrowResult.escrowPayment}
              onBack={() => setStep('milestones')}
              onSuccess={() => setStep('success')}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}

// ── Step dot ──────────────────────────────────────────────────────────────────

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={styles.stepDotWrap}>
      <div className={`${styles.stepDot} ${active ? styles.stepDotActive : ''} ${done ? styles.stepDotDone : ''}`}>
        {done ? <CheckCircle2 size={14} strokeWidth={2.5} /> : n}
      </div>
      <span className={`${styles.stepLabel} ${active ? styles.stepLabelActive : ''}`}>{label}</span>
    </div>
  );
}

// ── Milestones step ───────────────────────────────────────────────────────────

interface MilestonesStepProps {
  milestones:    MilestoneInput[];
  totalPercent:  number;
  totalAmount:   number;
  error:         string | null;
  isSubmitting:  boolean;
  onAutoSuggest: () => void;
  onAdd:         () => void;
  onRemove:      (i: number) => void;
  onChange:      (i: number, field: keyof MilestoneInput, value: string | number) => void;
  onContinue:    () => void;
}

function MilestonesStep({
  milestones, totalPercent, totalAmount, error,
  isSubmitting, onAutoSuggest, onAdd, onRemove, onChange, onContinue,
}: MilestonesStepProps) {
  const percentOk = Math.abs(totalPercent - 100) < 0.01;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderLeft}>
          <Layers size={16} strokeWidth={1.75} />
          <span>Payment milestones</span>
        </div>
        <button className={styles.autoBtn} onClick={onAutoSuggest}>
          <Wand2 size={13} strokeWidth={2} />
          Auto-suggest
        </button>
      </div>

      <div className={styles.cardBody}>
        {milestones.length === 0 ? (
          <div className={styles.emptyMilestones}>
            <p>No milestones yet. Click <strong>Auto-suggest</strong> or add one manually.</p>
          </div>
        ) : (
          <div className={styles.milestoneList}>
            {milestones.map((m, i) => (
              <MilestoneRow
                key={i}
                index={i}
                milestone={m}
                amount={totalAmount * (m.percentage / 100)}
                onChange={onChange}
                onRemove={onRemove}
                canRemove={milestones.length > 1}
              />
            ))}
          </div>
        )}

        {/* Totals bar */}
        <div className={styles.totalsBar}>
          <div className={`${styles.totalPct} ${percentOk ? styles.totalPctOk : totalPercent > 0 ? styles.totalPctError : ''}`}>
            {totalPercent}% of 100%
          </div>
          <div className={styles.totalAmount}>
            <DollarSign size={13} strokeWidth={2} />
            Total: ${totalAmount.toLocaleString()}
          </div>
        </div>

        {/* Add milestone */}
        {milestones.length < 10 && (
          <button className={styles.addBtn} onClick={onAdd}>
            <Plus size={14} strokeWidth={2.5} /> Add milestone
          </button>
        )}
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={14} strokeWidth={2} /> {error}
        </div>
      )}

      <div className={styles.cardFooter}>
        <span className={styles.footerHint}>Platform fee: 5% of total</span>
        <Button variant="primary" onClick={onContinue} disabled={isSubmitting || milestones.length === 0}>
          {isSubmitting ? 'Creating escrow…' : 'Continue to payment →'}
        </Button>
      </div>
    </div>
  );
}

// ── Milestone row ─────────────────────────────────────────────────────────────

interface MilestoneRowProps {
  index:     number;
  milestone: MilestoneInput;
  amount:    number;
  onChange:  (i: number, field: keyof MilestoneInput, value: string | number) => void;
  onRemove:  (i: number) => void;
  canRemove: boolean;
}

function MilestoneRow({ index, milestone, amount, onChange, onRemove, canRemove }: MilestoneRowProps) {
  return (
    <div className={styles.milestoneRow}>
      <div className={styles.milestoneOrder}>{index + 1}</div>
      <div className={styles.milestoneFields}>
        <input
          className={styles.milestoneTitle}
          placeholder="Milestone title"
          value={milestone.title}
          onChange={(e) => onChange(index, 'title', e.target.value)}
        />
        <div className={styles.milestoneBottom}>
          <input
            className={styles.milestoneDesc}
            placeholder="Description (optional)"
            value={milestone.description ?? ''}
            onChange={(e) => onChange(index, 'description', e.target.value)}
          />
          <div className={styles.pctWrap}>
            <input
              type="number"
              className={styles.pctInput}
              min={1}
              max={100}
              value={milestone.percentage || ''}
              onChange={(e) => onChange(index, 'percentage', parseFloat(e.target.value) || 0)}
            />
            <span className={styles.pctSymbol}>%</span>
          </div>
          <span className={styles.milestoneAmount}>
            ${isFinite(amount) && amount > 0 ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
          </span>
        </div>
      </div>
      {canRemove && (
        <button className={styles.removeBtn} onClick={() => onRemove(index)} aria-label="Remove">
          <Trash2 size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

// ── Payment step ──────────────────────────────────────────────────────────────

function PaymentStep({
  escrow,
  onBack,
  onSuccess,
}: {
  escrow:     EscrowPayment;
  onBack:     () => void;
  onSuccess:  () => void;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setError(null);
    setLoading(true);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${window.location.origin}/dashboard/jobs/${escrow.jobId}/fund?funded=1`,
      },
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.');
    } else if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
      onSuccess();
    }
    setLoading(false);
  };

  const fee = escrow.platformFeeAmount;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderLeft}>
          <DollarSign size={16} strokeWidth={1.75} />
          <span>Complete payment</span>
        </div>
      </div>

      <div className={styles.cardBody}>
        {/* Payment summary */}
        <div className={styles.paymentSummary}>
          <div className={styles.paymentRow}>
            <span>Escrow amount</span>
            <span>${escrow.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className={styles.paymentRow}>
            <span>Platform fee (5%)</span>
            <span>${fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className={`${styles.paymentRow} ${styles.paymentTotal}`}>
            <span>Total charged today</span>
            <span>${(escrow.totalAmount + fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Stripe payment element */}
        <div className={styles.stripeWrap}>
          <PaymentElement options={{ layout: 'tabs' }} />
        </div>

        {error && (
          <div className={styles.errorBanner} style={{ margin: '0 0 4px' }}>
            <AlertCircle size={14} strokeWidth={2} /> {error}
          </div>
        )}
      </div>

      <div className={styles.cardFooter}>
        <button className={styles.backBtn} onClick={onBack} disabled={loading}>
          ← Back
        </button>
        <Button variant="primary" onClick={handlePay} disabled={loading || !stripe}>
          {loading ? 'Processing…' : `Pay $${(escrow.totalAmount + fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
        </Button>
      </div>
    </div>
  );
}
