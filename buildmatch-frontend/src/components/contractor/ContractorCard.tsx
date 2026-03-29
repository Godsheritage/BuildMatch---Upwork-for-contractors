import { Link } from 'react-router-dom';
import { MapPin, Briefcase, Shield, Award, CheckCircle, ArrowRight } from 'lucide-react';
import { useLang } from '../../context/LanguageContext';
import { ReliabilityScoreBadge } from './ReliabilityScoreBadge';
import type { ContractorProfile } from '../../types/contractor.types';
import styles from './ContractorCard.module.css';

interface ContractorCardProps {
  contractor: ContractorProfile;
}

// First two letters of name for avatar fallback
function initials(name: string) {
  const parts = name.trim().split(' ');
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

// Star rendering — filled amber stars
function Stars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width="13" height="13" viewBox="0 0 24 24" fill="none">
          <polygon
            points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
            fill={n <= Math.round(rating) ? '#F59E0B' : '#E5E4E0'}
            stroke="none"
          />
        </svg>
      ))}
    </span>
  );
}

export function ContractorCard({ contractor }: ContractorCardProps) {
  const { t } = useLang();
  const { user, id } = contractor;
  const fullName = `${user.firstName} ${user.lastName}`;
  const location = [contractor.city, contractor.state].filter(Boolean).join(', ');

  const hasRating = contractor.averageRating > 0;

  // Up to 3 specialty pills; rest in services text
  const pills = contractor.specialties.slice(0, 3);
  const allServices = contractor.specialties
    .map((s) => t.specialties[s as keyof typeof t.specialties] ?? s);
  const serviceLabel =
    allServices.length <= 4
      ? allServices.join(', ')
      : `${allServices.slice(0, 3).join(', ')}, +${allServices.length - 3} more`;

  const isPartner = contractor.isLicenseVerified;

  return (
    <Link to={`/contractors/${id}`} className={styles.card}>
      {/* Coloured banner */}
      <div className={styles.banner}>
        {isPartner && (
          <span className={styles.partnerBadge}>
            <Award size={11} strokeWidth={2} />
            Official Partner
          </span>
        )}
      </div>

      {/* Avatar overlapping the banner */}
      <div className={styles.avatarWrap}>
        {contractor.avatarUrl ? (
          <img src={contractor.avatarUrl} alt={fullName} className={styles.avatarImg} />
        ) : (
          <div className={styles.avatarFallback}>{initials(fullName).toUpperCase()}</div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        <p className={styles.name}>{fullName}</p>

        {location && (
          <p className={styles.location}>
            <MapPin size={11} strokeWidth={2} />
            {location}
          </p>
        )}

        {/* Rating + Verified */}
        <div className={styles.ratingRow}>
          <Stars rating={contractor.averageRating} />
          {hasRating ? (
            <>
              <span className={styles.ratingValue}>
                {contractor.averageRating.toFixed(1)}
              </span>
              <span className={styles.ratingCount}>({contractor.totalReviews})</span>
            </>
          ) : (
            <span className={styles.ratingCount}>New</span>
          )}
          {contractor.isLicenseVerified && (
            <span className={styles.verifiedBadge}>
              <CheckCircle size={10} strokeWidth={2.5} />
              Verified
            </span>
          )}
          {contractor.reliabilityScore != null && contractor.reliabilityScore > 0 && (
            <ReliabilityScoreBadge score={contractor.reliabilityScore} size="sm" />
          )}
        </div>

        {/* Specialty pills */}
        {pills.length > 0 && (
          <div className={styles.pills}>
            {pills.map((s) => (
              <span key={s} className={styles.pill}>
                {t.specialties[s as keyof typeof t.specialties] ?? s}
              </span>
            ))}
          </div>
        )}

        {/* Services */}
        {allServices.length > 0 && (
          <>
            <p className={styles.servicesLabel}>Services:</p>
            <p className={styles.servicesText}>{serviceLabel}</p>
          </>
        )}

        {/* Experience + Licensed */}
        <div className={styles.metaRow}>
          {contractor.yearsExperience > 0 && (
            <span className={styles.metaItem}>
              <Briefcase size={12} strokeWidth={1.75} />
              {contractor.yearsExperience} yr{contractor.yearsExperience !== 1 ? 's' : ''}
            </span>
          )}
          {contractor.licenseNumber && (
            <span className={`${styles.metaItem} ${styles.licensedItem}`}>
              <Shield size={12} strokeWidth={1.75} />
              Licensed
            </span>
          )}
          {contractor.isAvailable && (
            <span className={`${styles.metaItem} ${styles.availableItem}`}>
              Available
            </span>
          )}
        </div>

        {/* Bio */}
        {contractor.bio && (
          <>
            <hr className={styles.divider} />
            <p className={styles.bio}>{contractor.bio}</p>
          </>
        )}

        {/* CTA */}
        <div className={styles.cta}>
          View Profile
          <ArrowRight size={14} strokeWidth={2} className={styles.ctaArrow} />
        </div>
      </div>
    </Link>
  );
}
