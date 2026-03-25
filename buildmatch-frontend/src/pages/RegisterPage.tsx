import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, HardHat, CheckCircle2, Circle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import type { UserRole } from '../types/user.types';

type Role = Exclude<UserRole, 'ADMIN'>;

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: Role | '';
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
}

const ROLES: { value: Role; icon: React.ElementType; title: string; description: string }[] = [
  {
    value: 'INVESTOR',
    icon: Building2,
    title: "I'm an Investor",
    description: 'Post jobs and hire skilled contractors',
  },
  {
    value: 'CONTRACTOR',
    icon: HardHat,
    title: "I'm a Contractor",
    description: 'Find projects and grow your business',
  },
];

const PASSWORD_CHECKS = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number',            test: (p: string) => /[0-9]/.test(p) },
];

function validate(v: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!v.role) errors.role = 'Please select your account type';

  if (!v.firstName.trim()) errors.firstName = 'First name is required';
  else if (v.firstName.trim().length < 2) errors.firstName = 'Must be at least 2 characters';

  if (!v.lastName.trim()) errors.lastName = 'Last name is required';
  else if (v.lastName.trim().length < 2) errors.lastName = 'Must be at least 2 characters';

  if (!v.email) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = 'Enter a valid email address';

  if (v.phone && !/^\+?[\d\s\-(). ]{7,20}$/.test(v.phone)) {
    errors.phone = 'Enter a valid phone number';
  }

  if (!v.password) {
    errors.password = 'Password is required';
  } else if (v.password.length < 8) {
    errors.password = 'Must be at least 8 characters';
  } else if (!/[A-Z]/.test(v.password)) {
    errors.password = 'Must contain at least one uppercase letter';
  } else if (!/[0-9]/.test(v.password)) {
    errors.password = 'Must contain at least one number';
  }

  if (!v.confirmPassword) errors.confirmPassword = 'Please confirm your password';
  else if (v.password !== v.confirmPassword) errors.confirmPassword = 'Passwords do not match';

  return errors;
}

const INITIAL: FormValues = {
  firstName: '', lastName: '', email: '', phone: '',
  password: '', confirmPassword: '', role: '',
};

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState<FormValues>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function set<K extends keyof FormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
      if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    };
  }

  const selectRole = (role: Role) => {
    setValues((prev) => ({ ...prev, role }));
    if (fieldErrors.role) setFieldErrors((prev) => ({ ...prev, role: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await register({
        email: values.email,
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        role: values.role as Role,
        ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
      });
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

  const passwordChecks = PASSWORD_CHECKS.map((c) => ({ ...c, met: c.test(values.password) }));

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[480px]">

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
          <h1
            className="text-[22px] font-semibold text-[#1A1A18] mb-1"
            style={{ letterSpacing: '-0.02em' }}
          >
            Create your account
          </h1>
          <p className="text-sm text-muted mb-7">
            Join BuildMatch to connect with top contractors or find your next project.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-5">

              {/* Role selector */}
              <div>
                <p
                  className="text-[11px] font-medium text-muted uppercase mb-2.5"
                  style={{ letterSpacing: '0.06em' }}
                >
                  I am a…
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map(({ value, icon: Icon, title, description }) => {
                    const selected = values.role === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => selectRole(value)}
                        className={`flex flex-col items-start gap-2 p-4 rounded-lg text-left transition-all ${
                          selected
                            ? 'border-[1.5px] border-primary bg-highlight'
                            : 'border border-border bg-white hover:border-primary/30'
                        }`}
                      >
                        <Icon
                          size={20}
                          className={selected ? 'text-primary' : 'text-muted'}
                          strokeWidth={1.75}
                        />
                        <div>
                          <p className={`text-sm font-semibold leading-snug ${selected ? 'text-primary' : 'text-[#1A1A18]'}`}>
                            {title}
                          </p>
                          <p className="text-xs text-muted mt-0.5 leading-snug">{description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.role && (
                  <p className="text-xs text-danger mt-2">{fieldErrors.role}</p>
                )}
              </div>

              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="firstName"
                  label="First name"
                  placeholder="Jane"
                  autoComplete="given-name"
                  value={values.firstName}
                  onChange={set('firstName')}
                  error={fieldErrors.firstName}
                />
                <Input
                  id="lastName"
                  label="Last name"
                  placeholder="Smith"
                  autoComplete="family-name"
                  value={values.lastName}
                  onChange={set('lastName')}
                  error={fieldErrors.lastName}
                />
              </div>

              {/* Email */}
              <Input
                id="email"
                type="email"
                label="Email address"
                placeholder="you@example.com"
                autoComplete="email"
                value={values.email}
                onChange={set('email')}
                error={fieldErrors.email}
              />

              {/* Phone (optional) */}
              <Input
                id="phone"
                type="tel"
                label="Phone number (optional)"
                placeholder="+1 (555) 000-0000"
                autoComplete="tel"
                value={values.phone}
                onChange={set('phone')}
                error={fieldErrors.phone}
              />

              {/* Password + strength checklist */}
              <div>
                <Input
                  id="password"
                  type="password"
                  label="Password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={values.password}
                  onChange={set('password')}
                  error={fieldErrors.password}
                />
                {values.password.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {passwordChecks.map(({ label, met }) => (
                      <div key={label} className="flex items-center gap-2">
                        {met
                          ? <CheckCircle2 size={13} className="text-accent flex-shrink-0" strokeWidth={2.5} />
                          : <Circle size={13} className="text-border flex-shrink-0" strokeWidth={2} />
                        }
                        <span className={`text-xs ${met ? 'text-accent' : 'text-muted'}`}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <Input
                id="confirmPassword"
                type="password"
                label="Confirm password"
                placeholder="••••••••"
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={set('confirmPassword')}
                error={fieldErrors.confirmPassword}
              />

              {/* Server error */}
              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-danger">
                  {serverError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full justify-center mt-1"
              >
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted whitespace-nowrap">Already have an account?</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Link to="/login" className="block w-full">
            <Button variant="secondary" className="w-full justify-center">
              Sign in
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
