import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import * as authService from '../services/auth.service';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';

type Stage = 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token    = params.get('token') ?? '';
  const { user } = useAuth();

  const [stage, setStage] = useState<Stage>('verifying');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!token) { setStage('error'); setError('Missing verification token.'); return; }
    authService
      .confirmEmailVerification(token)
      .then(() => setStage('success'))
      .catch((err) => {
        setStage('error');
        setError(err?.response?.data?.message ?? 'Invalid or expired link.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <Link to="/">
            <span className="text-2xl font-semibold text-primary" style={{ letterSpacing: '-0.02em' }}>
              BuildMatch
            </span>
          </Link>
        </div>
        <div
          className="bg-white border border-border rounded-xl px-8 py-10 text-center"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {stage === 'verifying' && (
            <p className="text-sm text-muted py-4">Verifying your email…</p>
          )}

          {stage === 'success' && (
            <>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                   style={{ background: 'var(--color-highlight)' }}>
                <CheckCircle2 size={22} color="var(--color-accent)" strokeWidth={1.75} />
              </div>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-2"
                  style={{ letterSpacing: '-0.02em' }}>
                Email verified
              </h1>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                Your email is now confirmed. Thanks for verifying.
              </p>
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={() => navigate(user ? '/dashboard/settings/verification' : '/login')}
              >
                {user ? 'Back to verification' : 'Sign in'}
              </Button>
            </>
          )}

          {stage === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                   style={{ background: '#FEE2E2' }}>
                <AlertTriangle size={22} color="#B91C1C" strokeWidth={1.75} />
              </div>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-2"
                  style={{ letterSpacing: '-0.02em' }}>
                Could not verify
              </h1>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                {error}
              </p>
              <Link to="/dashboard/settings/verification" className="block w-full">
                <Button variant="primary" className="w-full justify-center">
                  Request a new link
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
