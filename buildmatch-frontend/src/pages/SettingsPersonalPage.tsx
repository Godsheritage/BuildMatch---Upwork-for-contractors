import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, Pencil, Check, X,
  ExternalLink,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { getMyContractorProfile, updateMyProfile } from '../services/contractor.service';
import { updateUserProfile } from '../services/auth.service';
import { AvatarUpload } from '../components/ui/AvatarUpload';
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

export function SettingsPersonalPage() {
  const { user, updateUser } = useAuth();
  const { toast }            = useToast();
  const queryClient          = useQueryClient();
  const isContractor         = user?.role === 'CONTRACTOR';

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

  const name = `${user.firstName} ${user.lastName}`;

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

      {/* ── Profile photo ── */}
      <div className={styles.section}>
        <SectionHeader title="Profile photo" />
        <AvatarUpload
          name={name}
          currentAvatarUrl={user.avatarUrl}
          size="lg"
          onUploadComplete={(url) => updateUser({ avatarUrl: url })}
          onDelete={() => updateUser({ avatarUrl: null })}
        />
      </div>

      <div className={styles.divider} />

      {/* ── Visibility / Availability ── */}
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

      {/* ── Experience level (contractors) ── */}
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

      {/* ── Project preferences (investors) ── */}
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

      {/* ── Specialties / Categories (contractors) ── */}
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
