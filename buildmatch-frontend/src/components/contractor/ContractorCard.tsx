import { Link } from 'react-router-dom';
import { MapPin, Clock, Star, ShieldCheck } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import type { ContractorProfile } from '../../types/contractor.types';

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

interface ContractorCardProps {
  contractor: ContractorProfile;
}

export function ContractorCard({ contractor }: ContractorCardProps) {
  const { user, id } = contractor;
  const fullName = `${user.firstName} ${user.lastName}`;
  const location = [contractor.city, contractor.state].filter(Boolean).join(', ');

  const hasRate = contractor.hourlyRateMin != null || contractor.hourlyRateMax != null;
  const rateLabel = hasRate
    ? `$${contractor.hourlyRateMin ?? '?'}–$${contractor.hourlyRateMax ?? '?'}/hr`
    : null;

  const visibleSpecialties = contractor.specialties.slice(0, 3);
  const extraCount = contractor.specialties.length - visibleSpecialties.length;

  const hasRating = contractor.averageRating > 0;

  return (
    <Link
      to={`/contractors/${id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        className="bg-white border border-border rounded-xl p-5 transition-all"
        style={{
          display: 'flex', flexDirection: 'column', gap: 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
          (e.currentTarget as HTMLDivElement).style.borderColor = '#C8C8C4';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
          (e.currentTarget as HTMLDivElement).style.borderColor = '';
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <Avatar name={fullName} size="md" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p
                style={{
                  fontSize: 15, fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.01em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {fullName}
              </p>
              {contractor.isLicenseVerified && (
                <ShieldCheck size={14} color="var(--color-accent)" strokeWidth={2} style={{ flexShrink: 0 }} />
              )}
            </div>
            {location && (
              <p
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2,
                }}
              >
                <MapPin size={11} strokeWidth={2} />
                {location}
              </p>
            )}
          </div>
          {contractor.isAvailable && (
            <span
              style={{
                flexShrink: 0, fontSize: 11, fontWeight: 500,
                padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                background: 'var(--color-highlight)', color: 'var(--color-accent)',
              }}
            >
              Available
            </span>
          )}
        </div>

        {/* Bio */}
        {contractor.bio && (
          <p
            style={{
              fontSize: 13, color: 'var(--color-text-muted)',
              lineHeight: 1.6, marginBottom: 12,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {contractor.bio}
          </p>
        )}

        {/* Specialties */}
        {contractor.specialties.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {visibleSpecialties.map((s) => (
              <span
                key={s}
                style={{
                  fontSize: 11, fontWeight: 500,
                  padding: '3px 10px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {SPECIALTY_LABELS[s] ?? s}
              </span>
            ))}
            {extraCount > 0 && (
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                +{extraCount}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            paddingTop: 12, borderTop: '1px solid var(--color-border)',
            marginTop: 'auto',
          }}
        >
          {/* Rating */}
          <span
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: 'var(--color-text-muted)',
            }}
          >
            <Star
              size={12}
              strokeWidth={0}
              fill={hasRating ? 'var(--color-star)' : 'var(--color-border)'}
            />
            {hasRating ? (
              <>
                <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {contractor.averageRating.toFixed(1)}
                </span>
                <span>({contractor.totalReviews})</span>
              </>
            ) : (
              <span>New</span>
            )}
          </span>

          {/* Experience */}
          {contractor.yearsExperience > 0 && (
            <span
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, color: 'var(--color-text-muted)',
              }}
            >
              <Clock size={11} strokeWidth={2} />
              {contractor.yearsExperience} yr{contractor.yearsExperience !== 1 ? 's' : ''}
            </span>
          )}

          {/* Rate */}
          {rateLabel && (
            <span
              style={{
                marginLeft: 'auto', fontSize: 13, fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              {rateLabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
