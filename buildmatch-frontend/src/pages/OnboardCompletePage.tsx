import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function OnboardCompletePage() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();

  useEffect(() => {
    // Invalidate cached connect status so PaymentsPage refetches fresh data
    queryClient.invalidateQueries({ queryKey: ['stripe', 'connect-status'] });
    const t = setTimeout(() => navigate('/dashboard/payments'), 3000);
    return () => clearTimeout(t);
  }, [navigate, queryClient]);

  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 40,
      background: 'var(--color-surface)',
    }}>
      <CheckCircle2 size={52} color="#0F6E56" strokeWidth={1.5} style={{ marginBottom: 20 }} />
      <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.03em', marginBottom: 8 }}>
        Account connected!
      </h1>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
        Your payout account has been set up. You'll be redirected to your payments page shortly.
      </p>
    </div>
  );
}
