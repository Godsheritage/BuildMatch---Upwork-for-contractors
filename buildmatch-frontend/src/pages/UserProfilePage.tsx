import { Link } from 'react-router-dom';
import {
  MapPin, Globe, Share2, Eye, Pencil, Plus,
  Briefcase, Video, Award, Star, ChevronRight,
  CheckCircle2, Shield,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { getMyContractorProfile } from '../services/contractor.service';
import type { ContractorProfile } from '../types/contractor.types';
import styles from './UserProfilePage.module.css';
import { getOptimizedUrl, JOB_PHOTO_FALLBACK } from '../utils/media';
import { useState } from 'react';

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FEE2E2', text: '#991B1B' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#E0F2FE', text: '#0369A1' },
];

function getAvatarColor(name: string) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

// ── Specialty labels ──────────────────────────────────────────────────────────

const SPECIALTY_LABELS: Record<string, string> = {
  GENERAL: 'General Contractor', ELECTRICAL: 'Electrician',
  PLUMBING: 'Plumber', HVAC: 'HVAC', ROOFING: 'Roofer',
  FLOORING: 'Flooring', PAINTING: 'Painter', LANDSCAPING: 'Landscaper',
  DEMOLITION: 'Demolition', OTHER: 'Other Trade',
};

// ── Profile strength ──────────────────────────────────────────────────────────

interface StrengthItem {
  label: string;
  icon: React.ElementType;
  done: boolean;
  href: string;
}

function computeStrength(profile: ContractorProfile | null | undefined): StrengthItem[] {
  return [
    { label: 'Add a bio / about section',    icon: Pencil,    done: !!(profile?.bio),                   href: '/dashboard/profile/setup' },
    { label: 'Add your location',            icon: MapPin,    done: !!(profile?.city || profile?.state), href: '/dashboard/profile/setup' },
    { label: 'Set your hourly rate',         icon: Briefcase, done: !!(profile?.hourlyRateMin),          href: '/dashboard/profile/setup' },
    { label: 'Add specialties / skills',     icon: Star,      done: !!(profile?.specialties?.length),    href: '/dashboard/profile/setup' },
    { label: 'List years of experience',     icon: Award,     done: !!(profile?.yearsExperience),        href: '/dashboard/profile/setup' },
    { label: 'Add a portfolio image',        icon: Eye,       done: !!(profile?.portfolioImages?.length),href: '/dashboard/profile/setup' },
    { label: 'Verify your license',          icon: Shield,    done: !!(profile?.isLicenseVerified),      href: '/dashboard/profile/setup' },
    { label: 'Create an intro video',        icon: Video,     done: false,                               href: '/dashboard/profile/setup' },
  ];
}

function computeInvestorStrength(): StrengthItem[] {
  return [
    { label: 'Post your first job',          icon: Briefcase, done: false, href: '/dashboard/post-job' },
    { label: 'Browse available contractors', icon: Eye,       done: false, href: '/contractors' },
    { label: 'Hire a contractor',            icon: Award,     done: false, href: '/contractors' },
  ];
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function PortfolioThumb({ url, idx }: { url: string; idx: number }) {
  const [error, setError] = useState(false);
  return (
    <img
      src={error ? JOB_PHOTO_FALLBACK : getOptimizedUrl(url, 400)}
      alt={`Portfolio ${idx + 1}`}
      className={styles.portfolioImg}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

function ProfileSkeleton() {
  const blk = (w: string | number, h: number) => (
    <div className={styles.skeletonBlock} style={{ width: w, height: h, borderRadius: 4 }} />
  );
  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.card}>
          <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
            <div className={styles.skeletonBlock} style={{ width: 80, height: 80, borderRadius: '50%' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {blk('45%', 20)} {blk('30%', 13)} {blk('60%', 13)}
            </div>
          </div>
          {blk('100%', 12)} {blk('80%', 12)}
        </div>
        <div className={styles.card}>{blk('100%', 60)}</div>
      </div>
      <div className={styles.sidebar}>
        <div className={styles.strengthCard}>{blk('100%', 120)}</div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function UserProfilePage() {
  const { user } = useAuth();

  const isContractor = user?.role === 'CONTRACTOR';

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-contractor-profile'],
    queryFn:  getMyContractorProfile,
    enabled:  isContractor,
    retry:    false,
  });

  if (!user) return null;
  if (isLoading) return <div className={styles.page}><ProfileSkeleton /></div>;

  const fullName    = `${user.firstName} ${user.lastName}`;
  const initials    = getInitials(fullName);
  const color       = getAvatarColor(fullName);
  const location    = profile ? [profile.city, profile.state].filter(Boolean).join(', ') : null;
  const hasRate     = profile && (profile.hourlyRateMin != null || profile.hourlyRateMax != null);
  const rateLabel   = hasRate
    ? `$${profile?.hourlyRateMin ?? '?'}–$${profile?.hourlyRateMax ?? '?'}/hr`
    : null;

  const strengthItems = isContractor ? computeStrength(profile) : computeInvestorStrength();
  const doneCount     = strengthItems.filter((i) => i.done).length;
  const totalCount    = strengthItems.length;
  const strengthPct   = Math.round((doneCount / totalCount) * 100);

  const visibleItems  = strengthItems.slice(0, 4);

  return (
    <div className={styles.page}>
      <div className={styles.layout}>

        {/* ── Left main content ── */}
        <div className={styles.main}>

          {/* Profile header card */}
          <div className={styles.card}>
            <div className={styles.headerTop}>
              <div className={styles.avatarWrap}>
                <div
                  className={styles.avatar}
                  style={{ background: color.bg, color: color.text }}
                >
                  {initials}
                </div>
              </div>

              <div className={styles.headerMeta}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{fullName}</span>
                  <Link to="/dashboard/profile/setup" className={styles.editBtn} title="Edit profile">
                    <Pencil size={14} strokeWidth={2} />
                  </Link>
                </div>

                <div className={styles.tagline}>
                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                    {profile?.bio
                      ? profile.bio.split('.')[0] + '.'
                      : isContractor
                        ? 'Add your professional tagline…'
                        : 'Real estate investor on BuildMatch'
                    }
                  </span>
                  <Link to="/dashboard/profile/setup" className={styles.editBtn} title="Edit">
                    <Pencil size={12} strokeWidth={2} />
                  </Link>
                </div>

                <div className={styles.metaBadges}>
                  {location && (
                    <span className={styles.metaBadge}>
                      <MapPin size={11} strokeWidth={2} />
                      {location}
                    </span>
                  )}
                  <span className={styles.metaBadge}>
                    <Globe size={11} strokeWidth={2} />
                    Speaks English
                  </span>
                  {user.isVerified && (
                    <span className={styles.metaBadge} style={{ color: 'var(--color-accent)' }}>
                      <CheckCircle2 size={11} strokeWidth={2} />
                      Verified
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.headerActions}>
                <button className={styles.actionBtn}>
                  <Share2 size={13} strokeWidth={2} />
                  Share
                </button>
                <Link to={profile ? `/contractors/${profile.id}` : '#'} className={styles.actionBtn}>
                  <Eye size={13} strokeWidth={2} />
                  Preview
                </Link>
              </div>
            </div>

            {/* Stats row for contractors */}
            {isContractor && profile && (
              <div className={styles.statsRow}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{profile.completedJobs}</span>
                  <span className={styles.statLabel}>Jobs Done</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{profile.yearsExperience}</span>
                  <span className={styles.statLabel}>Yrs Exp</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>
                    {profile.totalReviews > 0 ? profile.averageRating.toFixed(1) : '—'}
                  </span>
                  <span className={styles.statLabel}>Rating</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{profile.totalReviews}</span>
                  <span className={styles.statLabel}>Reviews</span>
                </div>
              </div>
            )}

            {/* Availability toggle (contractor) */}
            {isContractor && profile && (
              <div className={styles.availabilityBar}>
                <span className={styles.availText}>Profile visibility</span>
                <div className={styles.availToggle}>
                  <div
                    className={styles.availDot}
                    style={{ background: profile.isAvailable ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                  />
                  <span
                    className={styles.availLabel}
                    style={{ color: profile.isAvailable ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                  >
                    {profile.isAvailable ? 'Available for work' : 'Not available'}
                  </span>
                  <Link to="/dashboard/profile/setup" className={styles.editBtn}>
                    <Pencil size={12} strokeWidth={2} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* About */}
          <div className={styles.card}>
            <p className={styles.sectionTitle}>About</p>
            {profile?.bio ? (
              <p className={styles.bio}>{profile.bio}</p>
            ) : (
              <div className={styles.emptySection}>
                <div className={styles.emptySectionText}>
                  <p className={styles.emptySectionTitle}>
                    {isContractor ? 'Tell clients about yourself' : 'Introduce yourself'}
                  </p>
                  <p className={styles.emptySectionDesc}>
                    A strong bio helps you stand out and attract better opportunities.
                  </p>
                  <Link to="/dashboard/profile/setup" className={styles.ctaBtn}>
                    <Plus size={13} strokeWidth={2} />
                    Add a bio
                  </Link>
                </div>
                <div className={styles.emptySectionIllustration}>
                  <Pencil size={24} color="var(--color-border)" strokeWidth={1.5} />
                </div>
              </div>
            )}
          </div>

          {/* Portfolio (contractors only) */}
          {isContractor && (
            <div className={styles.card}>
              <p className={styles.sectionTitle}>Portfolio of past projects</p>
              {profile?.portfolioImages && profile.portfolioImages.length > 0 ? (
                <div className={styles.portfolioGrid}>
                  {profile.portfolioImages.map((url, i) => (
                    <PortfolioThumb key={url || i} url={url} idx={i} />
                  ))}
                </div>
              ) : (
                <div className={styles.emptySection}>
                  <div className={styles.emptySectionText}>
                    <p className={styles.emptySectionTitle}>Portfolio of past projects</p>
                    <p className={styles.emptySectionDesc}>
                      Attract and impress potential clients by displaying your best work.
                    </p>
                    <Link to="/dashboard/profile/setup" className={styles.ctaBtn}>
                      <Plus size={13} strokeWidth={2} />
                      Start portfolio
                    </Link>
                  </div>
                  <div className={styles.emptySectionIllustration}>
                    <Eye size={24} color="var(--color-border)" strokeWidth={1.5} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Intro video */}
          <div className={styles.card}>
            <div className={styles.emptySection}>
              <div className={styles.emptySectionText}>
                <p className={styles.emptySectionTitle}>Intro video</p>
                <p className={styles.emptySectionDesc}>
                  Introduce yourself and make a connection with potential clients.
                </p>
                <button className={styles.ctaBtn}>
                  <Plus size={13} strokeWidth={2} />
                  Add intro video
                </button>
              </div>
              <div className={styles.emptySectionIllustration}>
                <Video size={24} color="var(--color-border)" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Skills and expertise (contractors) */}
          {isContractor && (
            <div className={styles.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p className={styles.sectionTitle} style={{ marginBottom: 0 }}>Skills and expertise</p>
                <Link to="/dashboard/profile/setup" className={styles.editBtn}>
                  <Plus size={14} strokeWidth={2} />
                </Link>
              </div>
              {profile?.specialties && profile.specialties.length > 0 ? (
                <div className={styles.skillsGrid}>
                  {profile.specialties.map((s) => (
                    <div key={s} className={styles.skillItem}>
                      <p className={styles.skillName}>{SPECIALTY_LABELS[s] ?? s}</p>
                      <p className={styles.skillLevel}>Pro</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptySection}>
                  <div className={styles.emptySectionText}>
                    <p className={styles.emptySectionDesc}>Add your specialties to help investors find you.</p>
                    <Link to="/dashboard/profile/setup" className={styles.ctaBtn}>
                      <Plus size={13} strokeWidth={2} />
                      Add new
                    </Link>
                  </div>
                </div>
              )}

              {/* Rate info */}
              {rateLabel && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                  <div className={styles.rateRow}>
                    <div className={styles.rateItem}>
                      <span className={styles.rateLabel}>Hourly Rate</span>
                      <span className={styles.rateValue}>{rateLabel}</span>
                    </div>
                    {profile?.yearsExperience ? (
                      <div className={styles.rateItem}>
                        <span className={styles.rateLabel}>Experience</span>
                        <span className={styles.rateValue}>{profile.yearsExperience} yr{profile.yearsExperience !== 1 ? 's' : ''}</span>
                      </div>
                    ) : null}
                    {profile?.licenseState && (
                      <div className={styles.rateItem}>
                        <span className={styles.rateLabel}>License State</span>
                        <span className={styles.rateValue}>{profile.licenseState}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Work experience (investor role or placeholder) */}
          {!isContractor && (
            <div className={styles.card}>
              <div className={styles.emptySection}>
                <div className={styles.emptySectionText}>
                  <p className={styles.emptySectionTitle}>Work experience</p>
                  <p className={styles.emptySectionDesc}>
                    Add your job history and achievements to give contractors insight into your projects.
                  </p>
                  <button className={styles.ctaBtn}>
                    <Plus size={13} strokeWidth={2} />
                    Add work experience
                  </button>
                </div>
                <div className={styles.emptySectionIllustration}>
                  <Briefcase size={24} color="var(--color-border)" strokeWidth={1.5} />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Right sidebar ── */}
        <div className={styles.sidebar}>

          {/* Profile Strength */}
          <div className={styles.strengthCard}>
            <div className={styles.strengthHeader}>
              <span className={styles.strengthTitle}>Profile Strength</span>
              <span>
                <span className={styles.strengthScore}>{doneCount}</span>
                <span className={styles.strengthScoreMax}>/{totalCount}</span>
              </span>
            </div>
            <p className={styles.strengthDesc}>
              A strong profile helps you stand out and attract better opportunities.
            </p>
            <div className={styles.strengthBar}>
              <div className={styles.strengthFill} style={{ width: `${strengthPct}%` }} />
            </div>
            <div className={styles.strengthItems}>
              {visibleItems.map(({ label, icon: Icon, done, href }) => (
                <Link key={label} to={href} className={styles.strengthItem}>
                  <div className={`${styles.strengthItemIcon} ${done ? styles.strengthItemIconDone : ''}`}>
                    {done
                      ? <CheckCircle2 size={14} color="var(--color-accent)" strokeWidth={2.5} />
                      : <Icon size={14} color="var(--color-text-muted)" strokeWidth={1.75} />
                    }
                  </div>
                  <span className={`${styles.strengthItemText} ${done ? styles.strengthItemTextDone : ''}`}>
                    {label}
                  </span>
                  {!done && <ChevronRight size={14} className={styles.strengthItemChevron} strokeWidth={2} />}
                </Link>
              ))}
            </div>
            {strengthItems.length > 4 && (
              <Link to="/dashboard/profile/setup" className={styles.showAll}>
                Show all ({strengthItems.length})
              </Link>
            )}
          </div>

          {/* Quick Links */}
          <div className={styles.quickLinksCard}>
            <p className={styles.quickLinksTitle}>Quick Links</p>
            {isContractor ? (
              <>
                <Link to="/dashboard/profile/setup" className={styles.quickLink}>
                  <Pencil size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                  Edit profile
                </Link>
                <Link to="/contractors" className={styles.quickLink}>
                  <Eye size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                  View public listing
                </Link>
                <Link to="/jobs" className={styles.quickLink}>
                  <Briefcase size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                  Browse jobs
                </Link>
              </>
            ) : (
              <>
                <Link to="/dashboard/post-job" className={styles.quickLink}>
                  <Plus size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                  Post a job
                </Link>
                <Link to="/contractors" className={styles.quickLink}>
                  <Eye size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                  Find contractors
                </Link>
                <Link to="/dashboard/jobs" className={styles.quickLink}>
                  <Briefcase size={14} strokeWidth={1.75} color="var(--color-text-muted)" />
                  My jobs
                </Link>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
