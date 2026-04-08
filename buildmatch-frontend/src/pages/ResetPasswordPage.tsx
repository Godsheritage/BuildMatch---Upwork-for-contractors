import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import * as authService from '../services/auth.service';
import { useToast } from '../context/ToastContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

type Stage = 'verifying' | 'invalid' | 'form' | 'success';

export function ResetPasswordPage() {
  const navigate    = useNavigate();
  const { toast }   = useToast();
  const [params]    = useSearchParams();
  const token       = params.get('token') ?? '';

  const [stage, setStage]               = useState<Stage>('verifying');
  const [maskedEmail, setMaskedEmail]   = useState<string>('');
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [fieldError, setFieldError]     = useState('');
  const [serverError, setServerError]   = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Probe the token on mount so we can show "expired" before the user types.
  useEffect(() => {
    if (!token) { setStage('invalid'); return; }
    authService
      .verifyResetToken(token)
      .then(({ email }) => {
        setMaskedEmail(email);
        setStage('form');
      })
      .catch(() => setStage('invalid'));
  }, [token]);

  const checks = [
    { label: 'At least 8 characters',  met: password.length >= 8 },
    { label: 'One uppercase letter',   met: /[A-Z]/.test(password) },
    { label: 'One number',             met: /[0-9]/.test(password) },
  ];
  const allMet = checks.every((c) => c.met);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    setFieldError('');
    if (!allMet) { setFieldError('Password does not meet the requirements.'); return; }
    if (password !== confirm) { setFieldError('Passwords do not match.'); return; }
    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, password);
      setStage('success');
      toast('Password updated. You can now sign in.');
      // Auto-redirect after a short pause
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message as string);
      } else {
        setServerError('Could not reset your password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

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
          className="bg-white border border-border rounded-xl px-8 py-10"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {/* Verifying */}
          {stage === 'verifying' && (
            <div className="text-center py-6">
              <p className="text-sm text-muted">Checking your reset link…</p>
            </div>
          )}

          {/* Invalid / expired */}
          {stage === 'invalid' && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                   style={{ background: '#FEE2E2' }}>
                <AlertTriangle size={22} color="#B91C1C" strokeWidth={1.75} />
              </div>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-2"
                  style={{ letterSpacing: '-0.02em' }}>
                Link expired or invalid
              </h1>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                Reset links expire after 1 hour and can only be used once.
                Request a new one to keep going.
              </p>
              <Link to="/forgot-password" className="block w-full mb-3">
                <Button variant="primary" className="w-full justify-center">
                  Request a new link
                </Button>
              </Link>
              <Link to="/login" className="block w-full">
                <Button variant="secondary" className="w-full justify-center">
                  Back to sign in
                </Button>
              </Link>
            </div>
          )}

          {/* Success */}
          {stage === 'success' && (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                   style={{ background: 'var(--color-highlight)' }}>
                <CheckCircle2 size={22} color="var(--color-accent)" strokeWidth={1.75} />
              </div>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-2"
                  style={{ letterSpacing: '-0.02em' }}>
                Password updated
              </h1>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                You can now sign in with your new password. Redirecting…
              </p>
            </div>
          )}

          {/* Form */}
          {stage === 'form' && (
            <>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-1"
                  style={{ letterSpacing: '-0.02em' }}>
                Set a new password
              </h1>
              <p className="text-sm text-muted mb-7 leading-relaxed">
                Resetting password for <span className="font-medium text-[#1A1A18]">{maskedEmail}</span>.
              </p>
              <form onSubmit={handleSubmit} noValidate>
                <div className="flex flex-col gap-4">
                  <Input
                    id="password"
                    type="password"
                    label="New password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldError(''); }}
                  />
                  {password.length > 0 && (
                    <div className="flex flex-col gap-1.5 -mt-2">
                      {checks.map(({ label, met }) => (
                        <div key={label} className="flex items-center gap-2">
                          {met
                            ? <CheckCircle2 size={13} className="text-accent flex-shrink-0" strokeWidth={2.5} />
                            : <Circle size={13} className="text-border flex-shrink-0" strokeWidth={2} />}
                          <span className={`text-xs ${met ? 'text-accent' : 'text-muted'}`}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Input
                    id="confirm"
                    type="password"
                    label="Confirm new password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setFieldError(''); }}
                  />
                  {fieldError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-danger">
                      {fieldError}
                    </div>
                  )}
                  {serverError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-danger">
                      {serverError}
                    </div>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || !allMet || password !== confirm}
                    className="w-full justify-center"
                  >
                    {isSubmitting ? 'Updating…' : 'Update password'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
