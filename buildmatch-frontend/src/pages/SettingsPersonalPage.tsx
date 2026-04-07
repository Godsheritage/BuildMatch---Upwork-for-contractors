import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, Pencil, Check, X,
  ExternalLink, Mail, Link2,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { getMyContractorProfile, updateMyProfile } from '../services/contractor.service';
import { updateUserProfile } from '../services/auth.service';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import styles from './SettingsPersonalPage.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPECIALTY_LABELS: Record<string, string> = {
  GENERAL: 'General Contractor', ELECTRICAL: 'Electrician',
  PLUMBING: 'Plumber', HVAC: 'HVAC', ROOFING: 'Roofer',
  FLOORING: 'Flooring', PAINTING: 'Painter', LANDSCAPING: 'Landscaper',
  DEMOLITION: 'Demolition', OTHER: 'Other Trade',
};

const ALL_SPECIALTIES = Object.keys(SPECIALTY_LABELS);

const EXPERIENCE_LEVELS = [
  { value: 'entry',        label: 'Entry level',   desc: 'I am relatively new to this field',         years: [0, 2]  },
  { value: 'intermediate', label: 'Intermediate',  desc: 'I have substantial experience in this field', years: [3, 6]  },
  { value: 'expert',       label: 'Expert',        desc: 'I have comprehensive and deep expertise',    years: [7, 99] },
] as const;

type ExpLevel = typeof EXPERIENCE_LEVELS[number]['value'];

function yearsToLevel(yrs: number): ExpLevel {
  if (yrs <= 2) return 'entry';
  if (yrs <= 6) return 'intermediate';
  return 'expert';
}

function levelToMinYears(level: ExpLevel): number {
  if (level === 'entry')        return 1;
  if (level === 'intermediate') return 3;
  return 7;
}

const PROJECT_PREFS = [
  { value: 'short',   label: 'Short-term',   desc: 'Quick fixes and smaller jobs' },
  { value: 'long',    label: 'Long-term',    desc: 'Large-scale renovations' },
  { value: 'both',    label: 'Both',         desc: 'Open to any project size'  },
] as const;
type ProjectPref = typeof PROJECT_PREFS[number]['value'];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, onEdit, editing }: { title: string; onEdit?: () => void; editing?: boolean }) {
  return (
    <div className={styles.sectionHeader}>
      <h2 className={styles.sectionHeading}>{title}</h2>
      {onEdit && (
        <button type="button" className={styles.editIconBtn} onClick={onEdit} aria-label="Edit">
          {editing ? <X size={15} strokeWidth={2} /> : <Pencil size={14} strokeWidth={2} />}
        </button>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

// Common time zones — short curated list. Browsers also expose
// Intl.supportedValuesOf('timeZone') which we use to expand the dropdown.
const TIMEZONE_FALLBACK = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Africa/Lagos', 'Africa/Johannesburg',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney',
];

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'de-DE', label: 'German' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'MDY',  label: 'MM/DD/YYYY (04/07/2026)' },
  { value: 'DMY',  label: 'DD/MM/YYYY (07/04/2026)' },
  { value: 'YMD',  label: 'YYYY-MM-DD (2026-04-07)' },
  { value: 'LONG', label: '7 Apr 2026' },
] as const;

const NUMBER_FORMAT_OPTIONS = [
  { value: 'EN', label: '1,200.50 (English)' },
  { value: 'EU', label: '1.200,50 (European)' },
] as const;

export function SettingsPersonalPage() {
  const { user, updateUser } = useAuth();
  const { toast }            = useToast();
  const queryClient          = useQueryClient();
  const isContractor         = user?.role === 'CONTRACTOR';

  // Detect the browser's IANA timezone for the default option
  const browserTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; }
  }, []);

  const timezoneOptions = useMemo(() => {
    try {
      // @ts-expect-error — supportedValuesOf is widely supported but not in older TS lib
      const all: string[] = Intl.supportedValuesOf?.('timeZone') ?? TIMEZONE_FALLBACK;
      return all.length > 0 ? all : TIMEZONE_FALLBACK;
    } catch { return TIMEZONE_FALLBACK; }
  }, []);

  const { data: profile } = useQuery({
    queryKey: ['my-contractor-profile'],
    queryFn:  getMyContractorProfile,
    enabled:  isContractor,
    retry:    false,
  });

  // ── Contractor states ──────────────────────────────────────────────────────
  const [availability,   setAvailability]   = useState<boolean>(profile?.isAvailable ?? true);
  const [expLevel,       setExpLevel]       = useState<ExpLevel>(yearsToLevel(profile?.yearsExperience ?? 0));
  const [specialties,    setSpecialties]    = useState<string[]>(profile?.specialties ?? []);
  const [editingSpec,    setEditingSpec]    = useState(false);
  const [savingAvail,    setSavingAvail]    = useState(false);
  const [savingExp,      setSavingExp]      = useState(false);
  const [savingSpec,     setSavingSpec]     = useState(false);

  // ── Investor states ────────────────────────────────────────────────────────
  const [projectPref, setProjectPref] = useState<ProjectPref>('both');

  // ── Identity (display name + pronouns) ─────────────────────────────────────
  const [displayName, setDisplayName] = useState<string>(user?.displayName ?? '');
  const [pronouns,    setPronouns]    = useState<string>(user?.pronouns    ?? '');
  const [savingIdentity, setSavingIdentity] = useState(false);

  // ── Bio + website (non-contractors) ────────────────────────────────────────
  const [bio,     setBio]     = useState<string>(user?.bio     ?? '');
  const [website, setWebsite] = useState<string>(user?.website ?? '');
  const [savingBio, setSavingBio] = useState(false);

  // ── Locale & format prefs ──────────────────────────────────────────────────
  const [timezone,     setTimezone]     = useState<string>(user?.timezone ?? browserTz);
  const [locale,       setLocale]       = useState<string>(user?.locale ?? 'en-US');
  const [dateFormat,   setDateFormat]   = useState<string>(user?.dateFormat ?? 'MDY');
  const [numberFormat, setNumberFormat] = useState<string>(user?.numberFormat ?? 'EN');
  const [savingLocale, setSavingLocale] = useState(false);

  // ── Quiet hours ────────────────────────────────────────────────────────────
  const [quietStart, setQuietStart] = useState<string>(user?.quietHoursStart ?? '');
  const [quietEnd,   setQuietEnd]   = useState<string>(user?.quietHoursEnd   ?? '');
  const [savingQuiet, setSavingQuiet] = useState(false);

  if (!user) return null;

  const profilePreviewUrl = isContractor && profile
    ? `/contractors/${profile.userId}`
    : null;

  // ── Save handlers ──────────────────────────────────────────────────────────

  async function saveAvailability(val: boolean) {
    if (!isContractor) return;
    setSavingAvail(true);
    try {
      await updateMyProfile({ isAvailable: val });
      setAvailability(val);
      queryClient.invalidateQueries({ queryKey: ['my-contractor-profile'] });
      toast(val ? 'Profile set to available.' : 'Profile set to unavailable.');
    } catch {
      toast('Could not update availability.', 'error');
    } finally {
      setSavingAvail(false);
    }
  }

  async function saveExperience(level: ExpLevel) {
    if (!isContractor) return;
    setSavingExp(true);
    setExpLevel(level);
    try {
      await updateMyProfile({ yearsExperience: levelToMinYears(level) });
      queryClient.invalidateQueries({ queryKey: ['my-contractor-profile'] });
    } catch {
      toast('Could not update experience level.', 'error');
      setExpLevel(yearsToLevel(profile?.yearsExperience ?? 0));
    } finally {
      setSavingExp(false);
    }
  }

  async function saveSpecialties() {
    if (!isContractor) return;
    setSavingSpec(true);
    try {
      await updateMyProfile({ specialties });
      queryClient.invalidateQueries({ queryKey: ['my-contractor-profile'] });
      setEditingSpec(false);
      toast('Specialties updated.');
    } catch {
      toast('Could not update specialties.', 'error');
    } finally {
      setSavingSpec(false);
    }
  }

  function toggleSpecialty(s: string) {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  // ── New: identity, bio, locale, quiet hours save handlers ──────────────────

  async function persistUserFields(payload: Record<string, string | null>, label: string) {
    try {
      const updated = await updateUserProfile(payload);
      updateUser(updated);
      toast(`${label} updated.`);
    } catch {
      toast(`Could not update ${label.toLowerCase()}.`, 'error');
      throw new Error('save failed');
    }
  }

  async function saveIdentity() {
    setSavingIdentity(true);
    try {
      await persistUserFields(
        { displayName: displayName.trim() || null, pronouns: pronouns.trim() || null },
        'Display name',
      );
    } catch {} finally { setSavingIdentity(false); }
  }

  async function saveBioWebsite() {
    setSavingBio(true);
    try {
      await persistUserFields(
        { bio: bio.trim() || null, website: website.trim() || null },
        'About',
      );
    } catch {} finally { setSavingBio(false); }
  }

  async function saveLocale() {
    setSavingLocale(true);
    try {
      await persistUserFields(
        {
          timezone:     timezone || null,
          locale:       locale || null,
          dateFormat:   dateFormat || null,
          numberFormat: numberFormat || null,
        },
        'Preferences',
      );
    } catch {} finally { setSavingLocale(false); }
  }

  async function saveQuiet() {
    if ((quietStart && !quietEnd) || (!quietStart && quietEnd)) {
      toast('Set both a start and end time, or leave both blank.', 'error');
      return;
    }
    setSavingQuiet(true);
    try {
      await persistUserFields(
        { quietHoursStart: quietStart || null, quietHoursEnd: quietEnd || null },
        'Quiet hours',
      );
    } catch {} finally { setSavingQuiet(false); }
  }

  return (
    <div className={styles.page}>
      {/* Back */}
      <Link to="/dashboard/settings" className={styles.back}>
        <ChevronLeft size={15} strokeWidth={2} />
        Account Settings
      </Link>

      {/* Page title row */}
      <div className={styles.titleRow}>
        <h1 className={styles.pageTitle}>My profile</h1>
        {profilePreviewUrl && (
          <Link to={profilePreviewUrl} className={styles.viewProfileLink} target="_blank" rel="noopener noreferrer">
            View my profile as others see it
            <ExternalLink size={13} strokeWidth={2} />
          </Link>
        )}
      </div>


      {/* ── 1. Display name & pronouns (identity) ── */}
      <div className={styles.section}>
        <SectionHeader title="Display name & pronouns" />
        <p className={styles.sectionDesc}>
          Your display name appears in messages and bids. Pronouns are optional.
        </p>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span className={styles.formLabel}>Display name</span>
            <input
              type="text"
              className={styles.formInput}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={`${user.firstName} ${user.lastName}`}
              maxLength={80}
            />
          </label>
          <label className={styles.formField}>
            <span className={styles.formLabel}>Pronouns</span>
            <input
              type="text"
              className={styles.formInput}
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              placeholder="e.g. she/her, they/them"
              maxLength={40}
            />
          </label>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={saveIdentity} disabled={savingIdentity}>
          {savingIdentity ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className={styles.divider} />

      {/* ── 2. About you (non-contractors) ── */}
      {!isContractor && (
        <>
          <div className={styles.section}>
            <SectionHeader title="About you" />
            <p className={styles.sectionDesc}>
              A short bio and personal link contractors will see when you message them or post a job.
            </p>
            <label className={styles.formField}>
              <span className={styles.formLabel}>Bio</span>
              <textarea
                className={styles.formInput}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Tell contractors a bit about yourself or your projects."
              />
            </label>
            <label className={styles.formField}>
              <span className={styles.formLabel}>Website</span>
              <input
                type="url"
                className={styles.formInput}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </label>
            <Button type="button" variant="primary" size="sm" onClick={saveBioWebsite} disabled={savingBio}>
              {savingBio ? 'Saving…' : 'Save'}
            </Button>
          </div>

          <div className={styles.divider} />
        </>
      )}

      {/* ── 3. Visibility / Availability ── */}
      <div className={styles.section}>
        <SectionHeader title="Visibility" />
        <p className={styles.sectionDesc}>
          {isContractor
            ? 'Control whether investors can find and contact you for new jobs.'
            : 'Control whether contractors can see your profile.'}
        </p>

        <div className={styles.visibilityCards}>
          {(isContractor
            ? [
                { value: true,  label: 'Available for work',    desc: 'Your profile is visible to investors searching for contractors.' },
                { value: false, label: 'Not available',          desc: 'Your profile is hidden from search results.' },
              ]
            : [
                { value: true,  label: 'Public profile',  desc: 'Contractors can see your profile and history.' },
                { value: false, label: 'Private profile', desc: 'Your profile is hidden from contractors.' },
              ]
          ).map(({ value, label, desc }) => (
            <button
              key={String(value)}
              type="button"
              className={`${styles.visCard} ${availability === value ? styles.visCardActive : ''}`}
              onClick={() => { if (!savingAvail && isContractor) saveAvailability(value); else setAvailability(value); }}
              disabled={savingAvail}
            >
              <span className={`${styles.visRadio} ${availability === value ? styles.visRadioOn : ''}`}>
                {availability === value && <Check size={10} strokeWidth={3} color="#fff" />}
              </span>
              <div className={styles.visCardText}>
                <p className={styles.visCardLabel}>{label}</p>
                <p className={styles.visCardDesc}>{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── 4. Experience level (contractors) ── */}
      {isContractor && (
        <>
          <div className={styles.section}>
            <SectionHeader title="Experience level" />
            <p className={styles.sectionDesc}>
              This helps investors understand your background when reviewing bids.
            </p>

            <div className={styles.expGrid}>
              {EXPERIENCE_LEVELS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.expCard} ${expLevel === value ? styles.expCardActive : ''}`}
                  onClick={() => { if (!savingExp) saveExperience(value); }}
                  disabled={savingExp}
                >
                  <div className={`${styles.expRadio} ${expLevel === value ? styles.expRadioOn : ''}`}>
                    {expLevel === value && <div className={styles.expRadioDot} />}
                  </div>
                  <p className={styles.expCardLabel}>{label}</p>
                  <p className={styles.expCardDesc}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.divider} />
        </>
      )}

      {/* ── 5. Specialties / Categories (contractors) ── */}
      {isContractor && (
        <>
          <div className={styles.section}>
            <SectionHeader
              title="Specialties"
              onEdit={() => setEditingSpec((v) => !v)}
              editing={editingSpec}
            />

            {editingSpec ? (
              <>
                <p className={styles.sectionDesc}>Select all trade types that apply to your work.</p>
                <div className={styles.specGrid}>
                  {ALL_SPECIALTIES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`${styles.specChip} ${specialties.includes(s) ? styles.specChipOn : ''}`}
                      onClick={() => toggleSpecialty(s)}
                    >
                      {specialties.includes(s) && <Check size={11} strokeWidth={3} />}
                      {SPECIALTY_LABELS[s]}
                    </button>
                  ))}
                </div>
                <div className={styles.specActions}>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={saveSpecialties}
                    disabled={savingSpec}
                  >
                    {savingSpec ? 'Saving…' : 'Save specialties'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSpecialties(profile?.specialties ?? []);
                      setEditingSpec(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : specialties.length > 0 ? (
              <div className={styles.tagList}>
                {specialties.map((s) => (
                  <span key={s} className={styles.tag}>{SPECIALTY_LABELS[s] ?? s}</span>
                ))}
              </div>
            ) : (
              <p className={styles.emptyHint}>
                No specialties added yet.{' '}
                <button type="button" className={styles.emptyHintLink} onClick={() => setEditingSpec(true)}>
                  Add your first
                </button>
              </p>
            )}
          </div>

          <div className={styles.divider} />
        </>
      )}

      {/* ── 6. Project preference (investors) ── */}
      {!isContractor && (
        <>
          <div className={styles.section}>
            <SectionHeader title="Project preference" />
            <p className={styles.sectionDesc}>
              What types of projects do you typically post?
            </p>

            <div className={styles.expGrid}>
              {PROJECT_PREFS.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.expCard} ${projectPref === value ? styles.expCardActive : ''}`}
                  onClick={() => setProjectPref(value)}
                >
                  <div className={`${styles.expRadio} ${projectPref === value ? styles.expRadioOn : ''}`}>
                    {projectPref === value && <div className={styles.expRadioDot} />}
                  </div>
                  <p className={styles.expCardLabel}>{label}</p>
                  <p className={styles.expCardDesc}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.divider} />
        </>
      )}

      {/* ── Locale & format preferences ── */}
      <div className={styles.section}>
        <SectionHeader title="Language & region" />
        <p className={styles.sectionDesc}>
          Controls how dates, numbers, and times are shown to you across BuildMatch.
        </p>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span className={styles.formLabel}>Time zone</span>
            <select
              className={styles.formInput}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              <option value="">Auto-detect ({browserTz || 'unknown'})</option>
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <label className={styles.formField}>
            <span className={styles.formLabel}>Language</span>
            <select
              className={styles.formInput}
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span className={styles.formLabel}>Date format</span>
            <select
              className={styles.formInput}
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
            >
              {DATE_FORMAT_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </label>
          <label className={styles.formField}>
            <span className={styles.formLabel}>Number format</span>
            <select
              className={styles.formInput}
              value={numberFormat}
              onChange={(e) => setNumberFormat(e.target.value)}
            >
              {NUMBER_FORMAT_OPTIONS.map((n) => (
                <option key={n.value} value={n.value}>{n.label}</option>
              ))}
            </select>
          </label>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={saveLocale} disabled={savingLocale}>
          {savingLocale ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>

      <div className={styles.divider} />

      {/* ── Quiet hours ── */}
      <div className={styles.section}>
        <SectionHeader title="Quiet hours" />
        <p className={styles.sectionDesc}>
          Don't send notifications between these times. Times are interpreted in your selected time zone. Leave both blank to receive notifications around the clock.
        </p>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span className={styles.formLabel}>From</span>
            <input
              type="time"
              className={styles.formInput}
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
            />
          </label>
          <label className={styles.formField}>
            <span className={styles.formLabel}>To</span>
            <input
              type="time"
              className={styles.formInput}
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
            />
          </label>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={saveQuiet} disabled={savingQuiet}>
          {savingQuiet ? 'Saving…' : 'Save quiet hours'}
        </Button>
      </div>

      <div className={styles.divider} />

      {/* ── Email address ── */}
      <div className={styles.section}>
        <SectionHeader title="Email address" />
        <p className={styles.sectionDesc}>Your account email. Changing it requires verification of the new address.</p>
        <div className={styles.formRow}>
          <label className={styles.formField} style={{ flex: 1 }}>
            <span className={styles.formLabel}>Current email</span>
            <input
              type="email"
              className={styles.formInput}
              value={user.email}
              disabled
              readOnly
            />
          </label>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => toast('Email change with verification is coming soon.', 'info')}
        >
          <Mail size={14} strokeWidth={2} style={{ marginRight: 6 }} />
          Change email
        </Button>
      </div>

      <div className={styles.divider} />

      {/* ── Connected accounts ── */}
      <div className={styles.section}>
        <SectionHeader title="Connected accounts" />
        <p className={styles.sectionDesc}>
          Link a third-party account so you can sign in with one click. No accounts linked yet.
        </p>
        <div className={styles.formRow}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => toast('Google sign-in is coming soon.', 'info')}
          >
            <Link2 size={14} strokeWidth={2} style={{ marginRight: 6 }} />
            Connect Google
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => toast('Apple sign-in is coming soon.', 'info')}
          >
            <Link2 size={14} strokeWidth={2} style={{ marginRight: 6 }} />
            Connect Apple
          </Button>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── AI preference ── */}
      <div className={styles.section}>
        <SectionHeader title="AI preference" />
        <p className={styles.sectionDesc}>
          Choose how BuildMatch AI uses your profile data for matching and recommendations.{' '}
          <span style={{ color: 'var(--color-text-muted)' }}>
            Your data is never shared with third parties.
          </span>
        </p>
        <Button type="button" variant="secondary" size="sm">
          Set preference
        </Button>
      </div>
    </div>
  );
}
