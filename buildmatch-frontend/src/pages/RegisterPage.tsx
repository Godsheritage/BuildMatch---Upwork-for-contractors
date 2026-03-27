import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, HardHat, CheckCircle2, Circle, ArrowLeft, Check } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../context/LanguageContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { AvatarUpload } from '../components/ui/AvatarUpload';
import type { UserRole } from '../types/user.types';

type Role = Exclude<UserRole, 'ADMIN'>;

const SPECIALTY_KEYS = [
  'GENERAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'ROOFING',
  'FLOORING', 'PAINTING', 'LANDSCAPING', 'DEMOLITION', 'OTHER',
] as const;

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  businessName: string;
  specialties: string[];
  zipCode: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  specialties?: string;
  zipCode?: string;
  password?: string;
  confirmPassword?: string;
}

const INITIAL: FormValues = {
  firstName: '', lastName: '', email: '', phone: '',
  businessName: '', specialties: [], zipCode: '',
  password: '', confirmPassword: '',
};

// ── Step 1: Role Selector ─────────────────────────────────────────────────────

function RoleStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: Role | '';
  onSelect: (r: Role) => void;
  onContinue: () => void;
}) {
  const { t } = useLang();

  const roles: { value: Role; icon: React.ElementType; title: string; description: string }[] = [
    { value: 'INVESTOR',   icon: Building2, title: t.register.roles.investor,   description: t.register.roles.investorDesc   },
    { value: 'CONTRACTOR', icon: HardHat,   title: t.register.roles.contractor, description: t.register.roles.contractorDesc },
  ];

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[480px]">
        <div className="text-center mb-8">
          <Link to="/"><span className="text-2xl font-semibold text-primary" style={{ letterSpacing: '-0.02em' }}>BuildMatch</span></Link>
        </div>

        <div className="bg-white border border-border rounded-xl px-8 py-10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-1" style={{ letterSpacing: '-0.02em' }}>
            {t.register.step1Title}
          </h1>
          <p className="text-sm text-muted mb-8">{t.register.step1Subtitle}</p>

          <div className="flex flex-col gap-4 mb-8">
            {roles.map(({ value, icon: Icon, title, description }) => {
              const isSelected = selected === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onSelect(value)}
                  className="text-left transition-all rounded-xl"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '18px 20px',
                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                    background: isSelected ? 'var(--color-highlight)' : '#fff',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                      border: isSelected ? 'none' : '1px solid var(--color-border)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Icon size={22} color={isSelected ? '#fff' : 'var(--color-text-muted)'} strokeWidth={1.75} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 15, fontWeight: 600,
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                      marginBottom: 3, letterSpacing: '-0.01em',
                    }}>
                      {title}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {description}
                    </p>
                  </div>
                  <div
                    style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      border: isSelected ? 'none' : '1.5px solid var(--color-border)',
                      background: isSelected ? 'var(--color-primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="primary"
            disabled={!selected}
            className="w-full justify-center"
            onClick={onContinue}
          >
            {t.register.continue} →
          </Button>

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

// ── Step 2: Registration Form ─────────────────────────────────────────────────

function FormStep({
  role,
  onBack,
  values,
  setValues,
  fieldErrors,
  setFieldErrors,
  serverError,
  isSubmitting,
  onSubmit,
}: {
  role: Role;
  onBack: () => void;
  values: FormValues;
  setValues: React.Dispatch<React.SetStateAction<FormValues>>;
  fieldErrors: FormErrors;
  setFieldErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
  serverError: string;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const { t } = useLang();
  const isContractor = role === 'CONTRACTOR';

  const roleIcon = isContractor ? HardHat : Building2;
  const RoleIcon = roleIcon;
  const roleTitle = isContractor ? t.register.roles.contractor : t.register.roles.investor;

  const passwordChecks = [
    { label: t.register.requirements.length,    met: values.password.length >= 8        },
    { label: t.register.requirements.uppercase, met: /[A-Z]/.test(values.password)      },
    { label: t.register.requirements.number,    met: /[0-9]/.test(values.password)      },
  ];

  function set<K extends keyof FormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
      if (key !== 'specialties' && fieldErrors[key as keyof FormErrors]) {
        setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
      }
    };
  }

  function toggleSpecialty(val: string) {
    const next = values.specialties.includes(val)
      ? values.specialties.filter((s) => s !== val)
      : [...values.specialties, val];
    setValues((prev) => ({ ...prev, specialties: next }));
    if (fieldErrors.specialties) setFieldErrors((prev) => ({ ...prev, specialties: undefined }));
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[520px]">
        <div className="text-center mb-8">
          <Link to="/"><span className="text-2xl font-semibold text-primary" style={{ letterSpacing: '-0.02em' }}>BuildMatch</span></Link>
        </div>

        <div className="bg-white border border-border rounded-xl px-8 py-10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-1" style={{ letterSpacing: '-0.02em' }}>
                {t.register.title}
              </h1>
              <p className="text-sm text-muted">{t.register.subtitle}</p>
            </div>
          </div>

          {/* Selected role chip */}
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              borderRadius: 20, background: 'var(--color-highlight)',
              border: '1px solid var(--color-primary)', marginBottom: 24,
            }}
          >
            <RoleIcon size={13} color="var(--color-primary)" strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-primary)' }}>
              {roleTitle}
            </span>
            <button
              type="button"
              onClick={onBack}
              style={{
                fontSize: 11, color: 'var(--color-primary)', background: 'none',
                border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500,
                opacity: 0.7, marginLeft: 2,
              }}
            >
              {t.register.changeRole}
            </button>
          </div>

          <form onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-4">

              {/* Name row */}
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

              {/* Contractor-only fields */}
              {isContractor && (
                <>
                  <Input
                    id="businessName"
                    label={t.register.labels.businessName}
                    placeholder={t.register.placeholders.businessName}
                    value={values.businessName}
                    onChange={set('businessName')}
                  />

                  {/* Trade specialties */}
                  <div>
                    <p style={{
                      fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)',
                      marginBottom: 8, letterSpacing: '0.01em',
                    }}>
                      {t.register.labels.specialties}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {SPECIALTY_KEYS.map((key) => {
                        const selected = values.specialties.includes(key);
                        const label = t.specialties[key as keyof typeof t.specialties] ?? key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleSpecialty(key)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                              fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
                              border: selected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: selected ? 'var(--color-highlight)' : '#fff',
                              color: selected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            }}
                          >
                            {selected && <Check size={10} strokeWidth={3} />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {fieldErrors.specialties && (
                      <p className="text-xs text-danger mt-2">{fieldErrors.specialties}</p>
                    )}
                  </div>

                  <Input
                    id="zipCode"
                    label={t.register.labels.zipCode}
                    placeholder={t.register.placeholders.zipCode}
                    value={values.zipCode}
                    onChange={set('zipCode')}
                    error={fieldErrors.zipCode}
                    maxLength={10}
                    style={{ maxWidth: 180 }}
                  />
                </>
              )}

              {/* Password */}
              <div>
                <Input id="password" type="password" label={t.register.labels.password}
                  placeholder={t.register.placeholders.password}
                  autoComplete="new-password" value={values.password} onChange={set('password')}
                  error={fieldErrors.password} />
                {values.password.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {passwordChecks.map(({ label, met }) => (
                      <div key={label} className="flex items-center gap-2">
                        {met
                          ? <CheckCircle2 size={13} className="text-accent flex-shrink-0" strokeWidth={2.5} />
                          : <Circle size={13} className="text-border flex-shrink-0" strokeWidth={2} />}
                        <span className={`text-xs ${met ? 'text-accent' : 'text-muted'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Input id="confirmPassword" type="password" label={t.register.labels.confirmPw}
                placeholder={t.register.placeholders.password}
                autoComplete="new-password" value={values.confirmPassword}
                onChange={set('confirmPassword')} error={fieldErrors.confirmPassword} />

              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-danger">
                  {serverError}
                </div>
              )}

              {/* Terms */}
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
                {t.register.terms}{' '}
                <Link to="/terms" target="_blank" style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'underline' }}>
                  {t.register.termsLink}
                </Link>
                {' '}{t.register.andText}{' '}
                <Link to="/terms" target="_blank" style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'underline' }}>
                  {t.register.privacyLink}
                </Link>.
              </p>

              <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full justify-center">
                {isSubmitting ? t.register.loading : t.register.submit}
              </Button>
            </div>
          </form>

          {/* Back + sign in */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted whitespace-nowrap">{t.register.haveAcct}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex-1"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 8, border: '1px solid var(--color-border)',
                background: '#fff', fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)',
                cursor: 'pointer', transition: 'background 0.15s', fontFamily: 'var(--font-family)',
              }}
            >
              <ArrowLeft size={14} strokeWidth={2} />
              {t.register.back}
            </button>
            <Link to="/login" className="flex-1">
              <Button variant="secondary" className="w-full justify-center">{t.register.signIn}</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Optional avatar ───────────────────────────────────────────────────

function AvatarStep({
  name,
  onComplete,
}: {
  name: string;
  onComplete: () => void;
}) {
  const { user, updateUser } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <Link to="/"><span className="text-2xl font-semibold text-primary" style={{ letterSpacing: '-0.02em' }}>BuildMatch</span></Link>
        </div>

        <div className="bg-white border border-border rounded-xl px-8 py-10 text-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h1 className="text-[22px] font-semibold text-[#1A1A18] mb-2" style={{ letterSpacing: '-0.02em' }}>
            Add a profile photo
          </h1>
          <p className="text-sm text-muted mb-8">Optional — you can always add one later.</p>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <AvatarUpload
              name={name}
              currentAvatarUrl={avatarUrl}
              size="lg"
              onUploadComplete={(url) => {
                setAvatarUrl(url);
                updateUser({ avatarUrl: url });
              }}
              onDelete={() => {
                setAvatarUrl(null);
                updateUser({ avatarUrl: null });
              }}
            />
          </div>

          <Button variant="primary" className="w-full justify-center mb-3" onClick={onComplete}>
            Continue to dashboard
          </Button>
          <button
            type="button"
            onClick={onComplete}
            style={{
              fontSize: 13, color: 'var(--color-text-muted)', background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const [step, setStep]             = useState<1 | 2 | 3>(1);
  const [role, setRole]             = useState<Role | ''>('');
  const [values, setValues]         = useState<FormValues>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(v: FormValues): FormErrors {
    const e: FormErrors = {};
    if (!v.firstName.trim())             e.firstName     = t.register.validation.firstRequired;
    else if (v.firstName.trim().length < 2) e.firstName  = t.register.validation.firstMin;
    if (!v.lastName.trim())              e.lastName      = t.register.validation.lastRequired;
    if (!v.email)                        e.email         = t.register.validation.emailRequired;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = t.register.validation.emailInvalid;
    if (v.phone && !/^\+?[\d\s\-(). ]{7,20}$/.test(v.phone)) e.phone = t.register.validation.phoneInvalid;
    if (role === 'CONTRACTOR') {
      if (v.specialties.length === 0)    e.specialties   = t.register.validation.specialtyRequired;
      if (!v.zipCode.trim())             e.zipCode       = t.register.validation.zipRequired;
    }
    if (!v.password)                     e.password      = t.register.validation.pwRequired;
    else if (v.password.length < 8)      e.password      = t.register.validation.pwMin;
    else if (!/[A-Z]/.test(v.password))  e.password      = t.register.validation.pwUppercase;
    else if (!/[0-9]/.test(v.password))  e.password      = t.register.validation.pwNumber;
    if (!v.confirmPassword)              e.confirmPassword = t.register.validation.confirmRequired;
    else if (v.password !== v.confirmPassword) e.confirmPassword = t.register.validation.pwMismatch;
    return e;
  }

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
        role: role as Role,
        ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
      });
      setStep(3);
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

  if (step === 1) {
    return (
      <RoleStep
        selected={role}
        onSelect={(r) => setRole(r)}
        onContinue={() => {
          if (role) setStep(2);
        }}
      />
    );
  }

  if (step === 3) {
    return (
      <AvatarStep
        name={`${values.firstName.trim()} ${values.lastName.trim()}`}
        onComplete={() => navigate('/dashboard')}
      />
    );
  }

  return (
    <FormStep
      role={role as Role}
      onBack={() => setStep(1)}
      values={values}
      setValues={setValues}
      fieldErrors={fieldErrors}
      setFieldErrors={setFieldErrors}
      serverError={serverError}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
    />
  );
}
