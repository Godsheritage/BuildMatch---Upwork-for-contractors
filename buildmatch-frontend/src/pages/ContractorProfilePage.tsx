import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, CheckCircle2, Briefcase, Clock, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getContractorById } from '../services/contractor.service';
import { Button } from '../components/ui/Button';
import { StarRating } from '../components/ui/StarRating';
import type { ContractorProfile } from '../types/contractor.types';
import styles from './ContractorProfilePage.module.css';

// ── Constants ──────────────────────────────────────────────────────────────

const SPECIALTY_LABELS: Record<string, string> = {
  GENERAL:     'General Contractor',
  ELECTRICAL:  'Electrician',
  PLUMBING:    'Plumber',
  HVAC:        'HVAC',
  ROOFING:     'Roofer',
  FLOORING:    'Flooring',
  PAINTING:    'Painter',
  LANDSCAPING: 'Landscaper',
  DEMOLITION:  'Demolition',
  OTHER:       'Other Trade',
};

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

// ── Large avatar (72px — beyond what the Avatar ui component supports) ─────

function LargeAvatar({ name }: { name: string }) {
  const color = getAvatarColor(name);
  return (
    <div
      style={{
        width: 72, height: 72, borderRadius: '50%',
        background: color.bg, color: color.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, fontWeight: 600,
        flexShrink: 0, userSelect: 'none',
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Skeleton loading layout ────────────────────────────────────────────────

function PageSkeleton() {
  const block = (w: number | string, h: number, style?: React.CSSProperties) => (
    <div className={styles.skeleton} style={{ width: w, height: h, borderRadius: 4, ...style }} />
  );
  return (
    <div className={styles.wrap}>
      {/* Sidebar skeleton */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarCard} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {block(72, 72, { borderRadius: '50%' })}
          {block('60%', 18)}
          {block('40%', 13)}
          {block('50%', 13)}
          {block('100%', 38, { marginTop: 4 })}
          {block('100%', 38)}
        </div>
      </div>
      {/* Content skeleton */}
      <div className={styles.content}>
        {[130, 110, 150].map((h, i) => (
          <div
            key={i}
            className={styles.section}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: h }}
          >
            {block('30%', 15)}
            {block('100%', 13)}
            {block('85%', 13)}
            {block('70%', 13)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Not found state ────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
        Contractor not found
      </p>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>
        This profile may have been removed or the link is incorrect.
      </p>
      <Link to="/contractors">
        <Button variant="secondary" size="sm">← Back to contractors</Button>
      </Link>
    </div>
  );
}

// ── Profile sidebar ────────────────────────────────────────────────────────

function ProfileSidebar({ contractor }: { contractor: ContractorProfile }) {
  const fullName = `${contractor.user.firstName} ${contractor.user.lastName}`;
  const location = [contractor.city, contractor.state].filter(Boolean).join(', ');
  const hasRate = contractor.hourlyRateMin != null || contractor.hourlyRateMax != null;
  const hasRating = contractor.averageRating > 0;

  return (
    <div className={styles.sidebarCard}>
      {/* Avatar + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
        <LargeAvatar name={fullName} />
        <h1
          style={{
            fontSize: 20, fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
            marginTop: 12, marginBottom: 6,
          }}
        >
          {fullName}
        </h1>

        {/* Star rating */}
        {hasRating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <StarRating rating={contractor.averageRating} size={13} />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              ({contractor.totalReviews} review{contractor.totalReviews !== 1 ? 's' : ''})
            </span>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>No reviews yet</p>
        )}

        {/* Location */}
        {location && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <MapPin size={12} strokeWidth={2} />
            {location}
          </p>
        )}
      </div>

      {/* Availability + rate */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Availability</span>
          <span
            style={{
              fontSize: 12, fontWeight: 500,
              padding: '2px 10px', borderRadius: 'var(--radius-pill)',
              background: contractor.isAvailable ? 'var(--color-highlight)' : 'var(--color-surface)',
              color: contractor.isAvailable ? 'var(--color-accent)' : 'var(--color-text-muted)',
            }}
          >
            {contractor.isAvailable ? 'Available' : 'Unavailable'}
          </span>
        </div>

        {hasRate && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Hourly rate</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              ${contractor.hourlyRateMin ?? '?'}–${contractor.hourlyRateMax ?? '?'}/hr
            </span>
          </div>
        )}
      </div>

      {/* CTA buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <Button
          variant="primary"
          className="w-full justify-center"
          onClick={() => {/* Phase 2 — contact flow */}}
        >
          Contact Contractor
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-center"
          onClick={() => {/* Phase 4 — save to list */}}
        >
          Save to List
        </Button>
      </div>

      {/* License badge */}
      {contractor.licenseNumber && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 12px',
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
          }}
        >
          <CheckCircle2 size={14} color="#16A34A" strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#15803D' }}>
            Licensed{contractor.licenseState ? ` · ${contractor.licenseState}` : ''}
          </span>
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--color-border)', marginBottom: 16 }} />

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCell}>
          <p className={styles.statValue}>{contractor.completedJobs}</p>
          <p className={styles.statLabel}>Jobs Done</p>
        </div>
        <div className={styles.statCell}>
          <p className={styles.statValue}>
            {hasRating ? contractor.averageRating.toFixed(1) : '—'}
          </p>
          <p className={styles.statLabel}>Avg Rating</p>
        </div>
        <div className={styles.statCell}>
          <p className={styles.statValue}>{'<1d'}</p>
          <p className={styles.statLabel}>Response</p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function ContractorProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: contractor, isLoading, isError } = useQuery({
    queryKey: ['contractors', id],
    queryFn: () => getContractorById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.navWordmark}>BuildMatch</Link>
        <Link to="/contractors" className={styles.navBack}>
          <ArrowLeft size={14} strokeWidth={2} />
          All contractors
        </Link>
      </nav>

      {isLoading && <PageSkeleton />}
      {(isError || (!isLoading && !contractor)) && <NotFound />}

      {contractor && (
        <div className={styles.wrap}>
          {/* Left sidebar */}
          <aside className={styles.sidebar}>
            <ProfileSidebar contractor={contractor} />
          </aside>

          {/* Right content */}
          <div className={styles.content}>

            {/* About */}
            {contractor.bio && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>About</h2>
                <p
                  style={{
                    fontSize: 14, color: 'var(--color-text-muted)',
                    lineHeight: 1.75, whiteSpace: 'pre-wrap',
                  }}
                >
                  {contractor.bio}
                </p>
              </section>
            )}

            {/* Specialties */}
            {contractor.specialties.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Specialties</h2>
                <div className={styles.pills}>
                  {contractor.specialties.map((s) => (
                    <span key={s} className={styles.pill}>
                      {SPECIALTY_LABELS[s] ?? s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Experience */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Experience</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Years */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Briefcase size={16} color="var(--color-text-muted)" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                      {contractor.yearsExperience > 0
                        ? `${contractor.yearsExperience} year${contractor.yearsExperience !== 1 ? 's' : ''} of experience`
                        : 'Experience not specified'}
                    </p>
                    {contractor.completedJobs > 0 && (
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {contractor.completedJobs} job{contractor.completedJobs !== 1 ? 's' : ''} completed on BuildMatch
                      </p>
                    )}
                  </div>
                </div>

                {/* License */}
                {contractor.licenseNumber && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Shield size={16} color="var(--color-text-muted)" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {contractor.licenseState
                          ? `Licensed in ${contractor.licenseState}`
                          : 'Licensed contractor'}
                        {contractor.isLicenseVerified && (
                          <CheckCircle2
                            size={13}
                            color="#16A34A"
                            strokeWidth={2}
                            style={{ display: 'inline', marginLeft: 6, verticalAlign: 'middle' }}
                          />
                        )}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        License #{contractor.licenseNumber}
                        {!contractor.isLicenseVerified && ' · Pending verification'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Insurance */}
                {contractor.insuranceExpiry && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Clock size={16} color="var(--color-text-muted)" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        Insured
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Coverage expires{' '}
                        {new Date(contractor.insuranceExpiry).toLocaleDateString('en-US', {
                          month: 'long', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      )}
    </div>
  );
}
