import { Link } from 'react-router-dom';
import { Briefcase, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../context/LanguageContext';
import { Button } from '../components/ui/Button';
import styles from './DashboardPage.module.css';

function getGreeting(morning: string, afternoon: string, evening: string): string {
  const h = new Date().getHours();
  if (h < 12) return morning;
  if (h < 18) return afternoon;
  return evening;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLang();

  if (!user) return null;

  const isInvestor = user.role === 'INVESTOR';
  const greeting = `${getGreeting(t.dashboard.greeting.morning, t.dashboard.greeting.afternoon, t.dashboard.greeting.evening)}, ${user.firstName}`;

  return (
    <div style={{ padding: '36px 40px', maxWidth: 960, margin: '0 auto', minHeight: '100%' }}>

      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
          {greeting}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
          {isInvestor ? t.dashboard.subtitle.investor : t.dashboard.subtitle.contractor}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
        {isInvestor ? (
          <>
            <div className={styles.statCard}><p className={styles.statLabel}>{t.dashboard.stats.activeJobs}</p><p className={styles.statValue}>0</p></div>
            <div className={styles.statCard}><p className={styles.statLabel}>{t.dashboard.stats.contractorsHired}</p><p className={styles.statValue}>0</p></div>
            <div className={styles.statCard}><p className={styles.statLabel}>{t.dashboard.stats.totalSpent}</p><p className={styles.statValue}>$0</p></div>
          </>
        ) : (
          <>
            <div className={styles.statCard}><p className={styles.statLabel}>{t.dashboard.stats.profileViews}</p><p className={styles.statValue}>0</p></div>
            <div className={styles.statCard}><p className={styles.statLabel}>{t.dashboard.stats.bidsSubmitted}</p><p className={styles.statValue}>0</p></div>
            <div className={styles.statCard}><p className={styles.statLabel}>{t.dashboard.stats.jobsWon}</p><p className={styles.statValue}>0</p></div>
          </>
        )}
      </div>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
          {isInvestor ? t.dashboard.sections.recentJobs : t.dashboard.sections.availableJobs}
        </h2>
        {isInvestor && (
          <Link to="/dashboard/post-job">
            <Button variant="primary" size="sm">{t.dashboard.sections.postJob}</Button>
          </Link>
        )}
      </div>

      {/* Empty state */}
      {isInvestor ? (
        <div className={styles.emptySection}>
          <div className={styles.emptyIconWrap}>
            <Briefcase size={24} color="var(--color-text-muted)" strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px', letterSpacing: '-0.01em' }}>
            {t.dashboard.empty.investorTitle}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: 320, margin: '0 auto 24px', lineHeight: 1.6 }}>
            {t.dashboard.empty.investorDesc}
          </p>
          <Link to="/dashboard/post-job"><Button variant="primary" size="sm">{t.dashboard.empty.investorCta}</Button></Link>
        </div>
      ) : (
        <div className={styles.emptySection}>
          <div className={styles.emptyIconWrap}>
            <Search size={24} color="var(--color-text-muted)" strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px', letterSpacing: '-0.01em' }}>
            {t.dashboard.empty.contractorTitle}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: 320, margin: '0 auto 24px', lineHeight: 1.6 }}>
            {t.dashboard.empty.contractorDesc}
          </p>
          <Link to="/profile"><Button variant="primary" size="sm">{t.dashboard.empty.contractorCta}</Button></Link>
        </div>
      )}
    </div>
  );
}
