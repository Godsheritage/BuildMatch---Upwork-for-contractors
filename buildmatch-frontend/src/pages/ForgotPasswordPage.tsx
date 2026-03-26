import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import axios from 'axios';
import * as authService from '../services/auth.service';
import { useLang } from '../context/LanguageContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function ForgotPasswordPage() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!email) { setEmailError(t.forgotPassword.validation.emailRequired); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError(t.forgotPassword.validation.emailInvalid); return; }
    setIsSubmitting(true);
    try {
      await authService.forgotPassword(email);
      setSubmitted(true);
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
          <Link to="/"><span className="text-2xl font-semibold text-primary" style={{ letterSpacing: '-0.02em' }}>BuildMatch</span></Link>
        </div>
        <div className="bg-white border border-border rounded-xl px-8 py-10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {submitted ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-highlight flex items-center justify-center mx-auto mb-4">
                <Mail size={22} className="text-accent" strokeWidth={1.75} />
              </div>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-2" style={{ letterSpacing: '-0.02em' }}>
                {t.forgotPassword.successTitle}
              </h1>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                {t.forgotPassword.successDesc.replace('{email}', email).split(email).length > 1
                  ? <>{t.forgotPassword.successDesc.split('{email}')[0]}<span className="font-medium text-[#1A1A18]">{email}</span>{t.forgotPassword.successDesc.split('{email}')[1]}</>
                  : t.forgotPassword.successDesc.replace('{email}', email)
                }
              </p>
              <p className="text-xs text-muted mb-6">
                {t.forgotPassword.noReceive}{' '}
                <button type="button" className="font-medium text-primary hover:opacity-75 transition-opacity"
                  onClick={() => { setSubmitted(false); setServerError(''); }}>
                  {t.forgotPassword.tryAgain}
                </button>.
              </p>
              <Link to="/login" className="block w-full">
                <Button variant="primary" className="w-full justify-center">{t.forgotPassword.backToLogin}</Button>
              </Link>
            </div>
          ) : (
            <>
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[#1A1A18] transition-colors mb-6">
                <ArrowLeft size={15} strokeWidth={2} />{t.forgotPassword.backToLogin}
              </Link>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-1" style={{ letterSpacing: '-0.02em' }}>
                {t.forgotPassword.title}
              </h1>
              <p className="text-sm text-muted mb-7 leading-relaxed">{t.forgotPassword.desc}</p>
              <form onSubmit={handleSubmit} noValidate>
                <div className="flex flex-col gap-5">
                  <Input id="email" type="email" label={t.forgotPassword.emailLabel} placeholder={t.forgotPassword.emailPH}
                    autoComplete="email" value={email}
                    onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                    error={emailError}
                  />
                  {serverError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-danger">{serverError}</div>
                  )}
                  <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full justify-center">
                    {isSubmitting ? t.forgotPassword.loading : t.forgotPassword.submit}
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
