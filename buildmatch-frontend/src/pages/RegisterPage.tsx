import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, HardHat, CheckCircle2, Circle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../context/LanguageContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import type { UserRole } from '../types/user.types';

type Role = Exclude<UserRole, 'ADMIN'>;

interface FormValues {
  firstName: string; lastName: string; email: string;
  phone: string; password: string; confirmPassword: string; role: Role | '';
}
interface FormErrors {
  firstName?: string; lastName?: string; email?: string;
  phone?: string; password?: string; confirmPassword?: string; role?: string;
}

const INITIAL: FormValues = { firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', role: '' };

export function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const [values, setValues] = useState<FormValues>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roles: { value: Role; icon: React.ElementType; title: string; description: string }[] = [
    { value: 'INVESTOR',   icon: Building2, title: t.register.roles.investor,   description: t.register.roles.investorDesc   },
    { value: 'CONTRACTOR', icon: HardHat,   title: t.register.roles.contractor, description: t.register.roles.contractorDesc },
  ];

  const passwordChecks = [
    { label: t.register.requirements.length,    test: (p: string) => p.length >= 8        },
    { label: t.register.requirements.uppercase, test: (p: string) => /[A-Z]/.test(p)      },
    { label: t.register.requirements.number,    test: (p: string) => /[0-9]/.test(p)      },
  ];

  function validate(v: FormValues): FormErrors {
    const e: FormErrors = {};
    if (!v.role)                        e.role          = t.register.validation.roleRequired;
    if (!v.firstName.trim())            e.firstName     = t.register.validation.firstRequired;
    else if (v.firstName.trim().length < 2) e.firstName = t.register.validation.firstMin;
    if (!v.lastName.trim())             e.lastName      = t.register.validation.lastRequired;
    if (!v.email)                       e.email         = t.register.validation.emailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = t.register.validation.emailInvalid;
    if (v.phone && !/^\+?[\d\s\-(). ]{7,20}$/.test(v.phone)) e.phone = t.register.validation.phoneInvalid;
    if (!v.password)                    e.password      = t.register.validation.pwRequired;
    else if (v.password.length < 8)     e.password      = t.register.validation.pwMin;
    else if (!/[A-Z]/.test(v.password)) e.password      = t.register.validation.pwUppercase;
    else if (!/[0-9]/.test(v.password)) e.password      = t.register.validation.pwNumber;
    if (!v.confirmPassword)             e.confirmPassword = t.register.validation.confirmRequired;
    else if (v.password !== v.confirmPassword) e.confirmPassword = t.register.validation.pwMismatch;
    return e;
  }

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
        email: values.email, password: values.password,
        firstName: values.firstName.trim(), lastName: values.lastName.trim(),
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

  const checks = passwordChecks.map((c) => ({ ...c, met: c.test(values.password) }));

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[480px]">
        <div className="text-center mb-8">
          <Link to="/"><span className="text-2xl font-semibold text-primary" style={{ letterSpacing: '-0.02em' }}>BuildMatch</span></Link>
        </div>
        <div className="bg-white border border-border rounded-xl px-8 py-10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-1" style={{ letterSpacing: '-0.02em' }}>{t.register.title}</h1>
          <p className="text-sm text-muted mb-7">{t.register.subtitle}</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-5">
              {/* Role selector */}
              <div>
                <p className="text-[11px] font-medium text-muted uppercase mb-2.5" style={{ letterSpacing: '0.06em' }}>
                  {t.register.rolePrompt}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {roles.map(({ value, icon: Icon, title, description }) => {
                    const selected = values.role === value;
                    return (
                      <button key={value} type="button" onClick={() => selectRole(value)}
                        className={`flex flex-col items-start gap-2 p-4 rounded-lg text-left transition-all ${selected ? 'border-[1.5px] border-primary bg-highlight' : 'border border-border bg-white hover:border-primary/30'}`}
                      >
                        <Icon size={20} className={selected ? 'text-primary' : 'text-muted'} strokeWidth={1.75} />
                        <div>
                          <p className={`text-sm font-semibold leading-snug ${selected ? 'text-primary' : 'text-[#1A1A18]'}`}>{title}</p>
                          <p className="text-xs text-muted mt-0.5 leading-snug">{description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.role && <p className="text-xs text-danger mt-2">{fieldErrors.role}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input id="firstName" label={t.register.labels.firstName} placeholder={t.register.placeholders.firstName}
                  autoComplete="given-name" value={values.firstName} onChange={set('firstName')} error={fieldErrors.firstName} />
                <Input id="lastName" label={t.register.labels.lastName} placeholder={t.register.placeholders.lastName}
                  autoComplete="family-name" value={values.lastName} onChange={set('lastName')} error={fieldErrors.lastName} />
              </div>

              <Input id="email" type="email" label={t.register.labels.email} placeholder={t.register.placeholders.email}
                autoComplete="email" value={values.email} onChange={set('email')} error={fieldErrors.email} />

              <Input id="phone" type="tel" label={t.register.labels.phone} placeholder={t.register.placeholders.phone}
                autoComplete="tel" value={values.phone} onChange={set('phone')} error={fieldErrors.phone} />

              <div>
                <Input id="password" type="password" label={t.register.labels.password} placeholder={t.register.placeholders.password}
                  autoComplete="new-password" value={values.password} onChange={set('password')} error={fieldErrors.password} />
                {values.password.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {checks.map(({ label, met }) => (
                      <div key={label} className="flex items-center gap-2">
                        {met ? <CheckCircle2 size={13} className="text-accent flex-shrink-0" strokeWidth={2.5} />
                             : <Circle size={13} className="text-border flex-shrink-0" strokeWidth={2} />}
                        <span className={`text-xs ${met ? 'text-accent' : 'text-muted'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Input id="confirmPassword" type="password" label={t.register.labels.confirmPw} placeholder={t.register.placeholders.password}
                autoComplete="new-password" value={values.confirmPassword} onChange={set('confirmPassword')} error={fieldErrors.confirmPassword} />

              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-danger">{serverError}</div>
              )}

              <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full justify-center mt-1">
                {isSubmitting ? t.register.loading : t.register.submit}
              </Button>
            </div>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted whitespace-nowrap">{t.register.haveAcct}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <Link to="/login" className="block w-full">
            <Button variant="secondary" className="w-full justify-center">{t.register.signIn}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
