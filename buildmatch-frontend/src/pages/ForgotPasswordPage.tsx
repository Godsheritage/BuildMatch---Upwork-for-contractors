import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import axios from 'axios';
import * as authService from '../services/auth.service';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!email) {
      setEmailError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address');
      return;
    }

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

        {/* Wordmark */}
        <div className="text-center mb-8">
          <Link to="/">
            <span
              className="text-2xl font-semibold text-primary"
              style={{ letterSpacing: '-0.02em' }}
            >
              BuildMatch
            </span>
          </Link>
        </div>

        {/* Card */}
        <div
          className="bg-white border border-border rounded-xl px-8 py-10"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {submitted ? (
            /* Success state */
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-highlight flex items-center justify-center mx-auto mb-4">
                <Mail size={22} className="text-accent" strokeWidth={1.75} />
              </div>
              <h1
                className="text-[22px] font-semibold text-[#1A1A18] mb-2"
                style={{ letterSpacing: '-0.02em' }}
              >
                Check your email
              </h1>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                If an account exists for{' '}
                <span className="font-medium text-[#1A1A18]">{email}</span>, we've
                sent a link to reset your password. It may take a few minutes to
                arrive.
              </p>
              <p className="text-xs text-muted mb-6">
                Didn't receive it? Check your spam folder or{' '}
                <button
                  type="button"
                  className="font-medium text-primary hover:opacity-75 transition-opacity"
                  onClick={() => {
                    setSubmitted(false);
                    setServerError('');
                  }}
                >
                  try again
                </button>
                .
              </p>
              <Link to="/login" className="block w-full">
                <Button variant="primary" className="w-full justify-center">
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[#1A1A18] transition-colors mb-6"
              >
                <ArrowLeft size={15} strokeWidth={2} />
                Back to sign in
              </Link>

              <h1
                className="text-[22px] font-semibold text-[#1A1A18] mb-1"
                style={{ letterSpacing: '-0.02em' }}
              >
                Reset your password
              </h1>
              <p className="text-sm text-muted mb-7 leading-relaxed">
                Enter the email address associated with your account and we'll
                send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="flex flex-col gap-5">
                  <Input
                    id="email"
                    type="email"
                    label="Email address"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    error={emailError}
                  />

                  {serverError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-danger">
                      {serverError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    className="w-full justify-center"
                  >
                    {isSubmitting ? 'Sending…' : 'Send reset link'}
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
