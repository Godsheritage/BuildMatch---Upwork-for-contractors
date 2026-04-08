import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, HardHat, CheckCircle2, Circle, ArrowLeft, Check } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../context/LanguageContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { AvatarUpload } from '../components/ui/AvatarUpload';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
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
  onGoogleSignUp,
  googleError,
}: {
  selected: Role | '';
  onSelect: (r: Role) => void;
  onContinue: () => void;
  onGoogleSignUp: (idToken: string, role: Role) => void;
  googleError: string;
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
            <span className="text-sm text-muted whitespace-nowrap">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {selected ? (
            <div className="flex justify-center">
              <GoogleSignInButton
                text="signup_with"
                onCredential={(idToken) => onGoogleSignUp(idToken, selected as Role)}
              />
            </div>
          ) : (
            <p className="text-xs text-muted text-center">
              Choose a role above to sign up with Google.
            </p>
          )}
          {googleError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-danger mt-4">
              {googleError}
            </div>
          )}

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
  googleMode,
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
  googleMode: boolean;
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

              <div>
                <Input
                  id="email"
                  type="email"
                  label={t.register.labels.email}
                  placeholder={t.register.placeholders.email}
                  autoComplete="email"
                  value={values.email}
                  onChange={set('email')}
                  error={fieldErrors.email}
                  disabled={googleMode}
                  readOnly={googleMode}
                />
                {googleMode && (
                  <p style={{ fontSize: 11, color: 'var(--color-accent)', marginTop: 4 }}>
                    Verified by Google — you can't change this email here.
                  </p>
                )}
              </div>

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

              {/* Password — hidden when signing up via Google */}
              {!googleMode && (
                <>
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
                </>
              )}

              {googleMode && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderRadius: 8,
                  background: 'var(--color-highlight)',
                  border: '1px solid var(--color-accent)',
                }}>
                  <CheckCircle2 size={16} color="var(--color-accent)" strokeWidth={2} />
                  <span style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 'var(--font-weight-medium)' as React.CSSProperties['fontWeight'] }}>
                    You'll sign in with Google. No password needed.
                  </span>
                </div>
              )}

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
  const { register, loginWithGoogle } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const [step, setStep]             = useState<1 | 2 | 3>(1);
  const [role, setRole]             = useState<Role | ''>('');
  const [values, setValues]         = useState<FormValues>(INITIAL);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // When set, the user is completing signup with a Google credential. We
  // hold the verified ID token and submit it alongside the form data.
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);
  const googleMode = googleIdToken !== null;

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
    // Password rules only apply for the email/password flow.
    if (!googleMode) {
      if (!v.password)                     e.password      = t.register.validation.pwRequired;
      else if (v.password.length < 8)      e.password      = t.register.validation.pwMin;
      else if (!/[A-Z]/.test(v.password))  e.password      = t.register.validation.pwUppercase;
      else if (!/[0-9]/.test(v.password))  e.password      = t.register.validation.pwNumber;
      if (!v.confirmPassword)              e.confirmPassword = t.register.validation.confirmRequired;
      else if (v.password !== v.confirmPassword) e.confirmPassword = t.register.validation.pwMismatch;
    }
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
      if (googleMode && googleIdToken) {
        // Google flow: re-send the verified ID token along with the form data.
        // The backend will create the account using these names + phone.
        await loginWithGoogle(googleIdToken, role as Role, {
          firstName: values.firstName.trim(),
          lastName:  values.lastName.trim(),
          phone:     values.phone.trim() || undefined,
        });
        setStep(3);
      } else {
        await register({
          email: values.email,
          password: values.password,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          role: role as Role,
          ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
        });
        setStep(3);
      }
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

  // Decode the (already-verified-by-Google) ID token client-side to extract
  // name + email for pre-filling the form. We never trust this for auth —
  // the backend re-verifies the token signature before creating an account.
  function decodeGoogleJwt(idToken: string): {
    email: string;
    given_name?: string;
    family_name?: string;
  } | null {
    try {
      const [, payload] = idToken.split('.');
      if (!payload) return null;
      const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const json = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  async function handleGoogleSignUp(idToken: string, selectedRole: Role) {
    setServerError('');
    // 1. First try a normal Google sign-in. If the user already exists
    //    (linked by googleId or email), we log them in immediately and
    //    skip the form entirely.
    try {
      await loginWithGoogle(idToken);
      navigate('/dashboard');
      return;
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : null;
      const message = axios.isAxiosError(err) ? err.response?.data?.message : null;

      // 400 means "no matching account, role required" → fall through to
      // the prefilled signup form. Anything else is a real error.
      if (status !== 400) {
        setServerError(message ?? 'Google sign-in failed. Please try again.');
        return;
      }
    }

    // 2. Brand-new user — pre-fill the form from the Google payload and
    //    advance to Step 2 in "Google mode".
    const payload = decodeGoogleJwt(idToken);
    if (!payload?.email) {
      setServerError('Could not read your Google profile. Please try again.');
      return;
    }
    setValues((prev) => ({
      ...prev,
      firstName: payload.given_name?.trim() ?? prev.firstName,
      lastName:  payload.family_name?.trim() ?? prev.lastName,
      email:     payload.email,
    }));
    setRole(selectedRole);
    setGoogleIdToken(idToken);
    setStep(2);
  }

  if (step === 1) {
    return (
      <RoleStep
        selected={role}
        onSelect={(r) => setRole(r)}
        onContinue={() => {
          if (role) setStep(2);
        }}
        onGoogleSignUp={handleGoogleSignUp}
        googleError={serverError}
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
      onBack={() => { setStep(1); setGoogleIdToken(null); }}
      values={values}
      setValues={setValues}
      fieldErrors={fieldErrors}
      setFieldErrors={setFieldErrors}
      serverError={serverError}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      googleMode={googleMode}
    />
  );
}
