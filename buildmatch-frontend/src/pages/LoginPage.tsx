import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../context/LanguageContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

interface FormErrors { email?: string; password?: string; }

export function LoginPage() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(email: string, password: string): FormErrors {
    const errors: FormErrors = {};
    if (!email) errors.email = t.login.error.emailReq;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = t.login.error.emailInvalid;
    if (!password) errors.password = t.login.error.pwReq;
    return errors;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const errors = validate(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message as string);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <span className="text-2xl font-semibold text-primary tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            BuildMatch
          </span>
        </div>
        <div className="bg-white border border-border rounded-xl px-8 py-10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-6" style={{ letterSpacing: '-0.02em' }}>
            {t.login.title}
          </h1>
          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-4">
              <Input id="email" type="email" label={t.login.email} placeholder={t.login.emailPH}
                autoComplete="email" value={email}
                onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined })); }}
                error={fieldErrors.email}
              />
              <div>
                <Input id="password" type="password" label={t.login.password} placeholder={t.login.passwordPH}
                  autoComplete="current-password" value={password}
                  onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  error={fieldErrors.password}
                />
                <div className="mt-2 text-right">
                  <Link to="/forgot-password" className="text-sm font-medium text-primary hover:opacity-75 transition-opacity">
                    {t.login.forgotPw}
                  </Link>
                </div>
              </div>
              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-danger">{serverError}</div>
              )}
              <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full justify-center mt-1">
                {isSubmitting ? t.login.loading : t.login.submit}
              </Button>
            </div>
          </form>
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted whitespace-nowrap">{t.login.newTo}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Link to="/register" className="block w-full">
            <Button variant="secondary" className="w-full justify-center">{t.login.createAcct}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
