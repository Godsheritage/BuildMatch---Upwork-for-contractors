import { CreditCard, CheckCircle2, ArrowRight, ExternalLink, AlertCircle } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getConnectStatus, createOnboardingLink } from '../services/stripe-connect.service';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import styles from './PaymentsPage.module.css';

const SETUP_STEPS = [
  "You'll be redirected to Stripe's secure site",
  'Provide your business or personal information',
  'Add your bank account for payouts',
  'Return here when complete',
];

export function PaymentsPage() {
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery({
    queryKey: ['stripe', 'connect-status'],
    queryFn:  getConnectStatus,
    retry:    false,
  });

  const { mutate: startOnboarding, isPending } = useMutation({
    mutationFn: createOnboardingLink,
    onSuccess:  (url) => { window.location.href = url; },
    onError:    () => toast('Failed to start onboarding. Please try again.', 'error'),
  });

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.skeleton} style={{ height: 28, width: 180, marginBottom: 8 }} />
          <div className={styles.skeleton} style={{ height: 16, width: 280, marginBottom: 32 }} />
          <div className={styles.skeleton} style={{ height: 320, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <h1 className={styles.heading}>Payment Setup</h1>
          <p className={styles.subheading}>Manage your payout account to receive milestone payments.</p>
        </div>

        {status?.isOnboarded ? (
          <OnboardedCard status={status} />
        ) : (
          <SetupCard onStart={() => startOnboarding()} loading={isPending} />
        )}
      </div>
    </div>
  );
}

// ── Setup card ────────────────────────────────────────────────────────────────

function SetupCard({ onStart, loading }: { onStart: () => void; loading: boolean }) {
  return (
    <div className={styles.card}>
      <div className={styles.calloutHeader}>
        <div className={styles.iconWrap}>
          <CreditCard size={22} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className={styles.calloutTitle}>Set up payouts to receive payments</h2>
          <p className={styles.calloutBody}>
            Connect your bank account through our secure payment partner, Stripe.
            This is required before you can receive milestone payments.
          </p>
        </div>
      </div>

      <div className={styles.stepsSection}>
        <p className={styles.stepsLabel}>What to expect</p>
        <ol className={styles.stepsList}>
          {SETUP_STEPS.map((step, i) => (
            <li key={i} className={styles.stepItem}>
              <span className={styles.stepNumber}>{i + 1}</span>
              <span className={styles.stepText}>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.calloutFooter}>
        <div className={styles.secureNote}>
          <AlertCircle size={13} strokeWidth={2} />
          Your data is encrypted and handled securely by Stripe.
        </div>
        <Button variant="primary" onClick={onStart} disabled={loading}>
          {loading ? 'Redirecting…' : 'Set up payouts'}
          {!loading && <ArrowRight size={15} strokeWidth={2} style={{ marginLeft: 6 }} />}
        </Button>
      </div>
    </div>
  );
}

// ── Onboarded card ────────────────────────────────────────────────────────────

function OnboardedCard({ status }: { status: { chargesEnabled: boolean; payoutsEnabled: boolean } }) {
  return (
    <div className={styles.card}>
      <div className={styles.connectedHeader}>
        <CheckCircle2 size={20} color="#0F6E56" strokeWidth={2} />
        <h2 className={styles.connectedTitle}>Payout account connected</h2>
      </div>

      <div className={styles.statusGrid}>
        <StatusRow label="Charges enabled"  ok={status.chargesEnabled} />
        <StatusRow label="Payouts enabled"  ok={status.payoutsEnabled} />
      </div>

      <div className={styles.connectedFooter}>
        <a
          href="https://dashboard.stripe.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.manageLink}
        >
          Manage payout settings
          <ExternalLink size={13} strokeWidth={2} style={{ marginLeft: 5 }} />
        </a>
      </div>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={styles.statusRow}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={`${styles.statusValue} ${ok ? styles.statusOk : styles.statusPending}`}>
        {ok ? 'Enabled' : 'Pending'}
      </span>
    </div>
  );
}
