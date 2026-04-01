import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { updateUserProfile } from '../services/auth.service';
import styles from './ProfileEditPage.module.css';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

interface FormValues {
  firstName: string;
  lastName:  string;
  phone:     string;
  bio:       string;
  city:      string;
  state:     string;
  company:   string;
  title:     string;
  website:   string;
}

interface FormErrors {
  firstName?: string;
  lastName?:  string;
  bio?:       string;
  website?:   string;
}

export function ProfileEditPage() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState<FormValues>({
    firstName: user?.firstName ?? '',
    lastName:  user?.lastName  ?? '',
    phone:     user?.phone     ?? '',
    bio:       user?.bio       ?? '',
    city:      user?.city      ?? '',
    state:     user?.state     ?? '',
    company:   user?.company   ?? '',
    title:     user?.title     ?? '',
    website:   user?.website   ?? '',
  });
  const [errors,       setErrors]       = useState<FormErrors>({});
  const [serverError,  setServerError]  = useState('');
  const [isSaving,     setIsSaving]     = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const redirectTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (redirectTimer.current) clearTimeout(redirectTimer.current); }, []);

  if (!user) return null;

  const isContractor = user.role === 'CONTRACTOR';

  function set<K extends keyof FormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
      setSaved(false);
      if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };
  }

  function validate(): boolean {
    const e: FormErrors = {};
    if (!values.firstName.trim()) e.firstName = 'First name is required';
    else if (values.firstName.trim().length < 2) e.firstName = 'At least 2 characters';
    if (!values.lastName.trim()) e.lastName = 'Last name is required';
    if (values.bio.length > 2000) e.bio = 'Bio must be under 2000 characters';
    if (values.website && !/^https?:\/\/.+/.test(values.website)) {
      e.website = 'Must start with http:// or https://';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;
    setIsSaving(true);
    try {
      const updated = await updateUserProfile({
        firstName: values.firstName.trim(),
        lastName:  values.lastName.trim(),
        phone:     values.phone.trim()   || null,
        bio:       values.bio.trim()     || null,
        city:      values.city.trim()    || null,
        state:     values.state          || null,
        company:   values.company.trim() || null,
        title:     values.title.trim()   || null,
        website:   values.website.trim() || null,
      });
      updateUser(updated);
      setSaved(true);
      setShowModal(true);
      redirectTimer.current = setTimeout(() => {
        navigate('/dashboard/settings');
      }, 2200);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message as string);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate('/dashboard/profile')}
          >
            <ArrowLeft size={16} strokeWidth={2} />
            Back to profile
          </button>
          <h1 className={styles.title}>Edit Profile</h1>
          <p className={styles.subtitle}>
            This information appears on your public profile and helps others connect with you.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Basic info ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Basic Information</p>
            <div className={styles.row2}>
              <Input
                id="firstName"
                label="First name"
                value={values.firstName}
                onChange={set('firstName')}
                error={errors.firstName}
                autoComplete="given-name"
              />
              <Input
                id="lastName"
                label="Last name"
                value={values.lastName}
                onChange={set('lastName')}
                error={errors.lastName}
                autoComplete="family-name"
              />
            </div>
            <Input
              id="phone"
              type="tel"
              label="Phone number (optional)"
              placeholder="+1 (555) 000-0000"
              value={values.phone}
              onChange={set('phone')}
              autoComplete="tel"
            />
          </div>

          {/* ── Professional identity ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Professional Identity</p>
            <Input
              id="title"
              label={isContractor ? 'Professional title' : 'Title / Role'}
              placeholder={isContractor ? 'e.g. Licensed General Contractor' : 'e.g. Real Estate Investor'}
              value={values.title}
              onChange={set('title')}
            />
            <Input
              id="company"
              label={isContractor ? 'Business name (optional)' : 'Company / Organization (optional)'}
              placeholder={isContractor ? 'e.g. Smith Construction LLC' : 'e.g. Apex Properties'}
              value={values.company}
              onChange={set('company')}
            />
            <Input
              id="website"
              type="url"
              label="Website (optional)"
              placeholder="https://yoursite.com"
              value={values.website}
              onChange={set('website')}
              error={errors.website}
            />
          </div>

          {/* ── Location ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Location</p>
            <div className={styles.row2}>
              <Input
                id="city"
                label="City"
                placeholder="e.g. Austin"
                value={values.city}
                onChange={set('city')}
              />
              <div className={styles.fieldWrap}>
                <label htmlFor="state" className={styles.label}>State</label>
                <select
                  id="state"
                  className={styles.select}
                  value={values.state}
                  onChange={set('state')}
                >
                  <option value="">— Select state —</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── About / Bio ── */}
          <div className={styles.section}>
            <p className={styles.sectionTitle}>About</p>
            <div className={styles.fieldWrap}>
              <label htmlFor="bio" className={styles.label}>
                Bio
                <span className={styles.charCount}>{values.bio.length} / 2000</span>
              </label>
              <textarea
                id="bio"
                className={[styles.textarea, errors.bio ? styles.textareaError : ''].join(' ')}
                placeholder={
                  isContractor
                    ? 'Tell clients about your experience, specialties, and what makes you stand out…'
                    : 'Tell contractors about yourself, your investment goals, and the kinds of projects you work on…'
                }
                rows={5}
                maxLength={2100}
                value={values.bio}
                onChange={set('bio')}
              />
              {errors.bio && <span className={styles.errorMsg}>{errors.bio}</span>}
            </div>
          </div>

          {/* Contractor note */}
          {isContractor && (
            <div className={styles.infoBox}>
              <p className={styles.infoText}>
                Trade specialties, hourly rate, portfolio images, and license info are managed in your{' '}
                <Link to="/dashboard/profile/setup" className={styles.infoLink}>
                  contractor profile wizard
                  <ExternalLink size={12} strokeWidth={2} style={{ marginLeft: 3 }} />
                </Link>.
              </p>
            </div>
          )}

          {serverError && (
            <div className={styles.errorBanner}>{serverError}</div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => navigate('/dashboard/profile')}
            >
              Cancel
            </button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {isSaving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
            </Button>
          </div>
        </form>

      </div>
    </div>

    {/* ── Success modal ── */}
    {showModal && (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalIcon}>
            <CheckCircle2 size={32} color="var(--color-accent)" strokeWidth={2} />
          </div>
          <h2 className={styles.modalTitle}>Changes saved</h2>
          <p className={styles.modalDesc}>Your profile has been updated successfully. Redirecting you to account settings…</p>
          <button
            className={styles.modalBtn}
            onClick={() => {
              if (redirectTimer.current) clearTimeout(redirectTimer.current);
              navigate('/dashboard/settings');
            }}
          >
            Go to Account Settings
          </button>
        </div>
      </div>
    )}
    </>
  );
}
