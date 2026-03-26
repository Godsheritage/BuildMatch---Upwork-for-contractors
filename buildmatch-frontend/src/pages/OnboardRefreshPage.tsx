import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createOnboardingLink } from '../services/stripe-connect.service';
import { Button } from '../components/ui/Button';

export function OnboardRefreshPage() {
  const [error, setError] = useState(false);

  useEffect(() => {
    createOnboardingLink()
      .then((url) => { window.location.href = url; })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div style={{
        minHeight: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 40,
        background: 'var(--color-surface)',
      }}>
        <p style={{ fontSize: 15, color: 'var(--color-text-primary)', marginBottom: 16 }}>
          Something went wrong. Please try again.
        </p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'var(--color-surface)',
    }}>
      <Loader2 size={32} color="var(--color-text-muted)" className="spin" strokeWidth={1.75} />
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Redirecting to Stripe…</p>
    </div>
  );
}
