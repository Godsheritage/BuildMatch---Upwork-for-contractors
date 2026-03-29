import { Link } from 'react-router-dom';
import {
  Users, Briefcase, DollarSign, TrendingUp,
  Scale, UserPlus, CheckCircle, AlertTriangle,
  MessageSquare, FileText,
} from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { AdminStatCard }   from '../../components/admin/shared/AdminStatCard';
import {
  useAdminStats,
  useOverviewStats,
  useOverviewActivity,
  useOverviewAlerts,
} from '../../hooks/useAdmin';
import styles from './AdminOverviewPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Feed icon helpers ─────────────────────────────────────────────────────────

type EventType = 'user_signup' | 'job_posted' | 'bid_submitted' | 'dispute_filed' | 'message_filtered';

function feedIcon(type: EventType) {
  if (type === 'user_signup')      return <UserPlus      size={13} />;
  if (type === 'job_posted')       return <Briefcase     size={13} />;
  if (type === 'bid_submitted')    return <FileText      size={13} />;
  if (type === 'dispute_filed')    return <Scale         size={13} />;
  if (type === 'message_filtered') return <MessageSquare size={13} />;
  return <TrendingUp size={13} />;
}

function feedIconCls(type: EventType): string {
  if (type === 'user_signup')      return styles.iconBlue;
  if (type === 'job_posted')       return styles.iconNavy;
  if (type === 'bid_submitted')    return styles.iconTeal;
  if (type === 'dispute_filed')    return styles.iconRed;
  if (type === 'message_filtered') return styles.iconAmber;
  return '';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatSkeleton() {
  return <div className={styles.statSkel} />;
}

function FeedSkeleton() {
  return (
    <div className={styles.feedSkel}>
      <div className={styles.skelCircle} />
      <div className={styles.skelBody}>
        <div className={`${styles.skelLine} ${styles.skelMed}`}   />
        <div className={`${styles.skelLine} ${styles.skelShort}`} />
      </div>
      <div className={`${styles.skelLine} ${styles.skelTiny}`} />
    </div>
  );
}

interface BarRowProps { label: string; value: number; max: number; barCls: string; }

function BarRow({ label, value, max, barCls }: BarRowProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <div className={styles.barTrack}>
        <div className={`${styles.barFill} ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.barValue}>{fmt(value)}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminOverviewPage() {
  const { data: overviewStats, dataUpdatedAt, isLoading: overviewLoading } = useOverviewStats();
  const { data: adminStats,    isLoading: adminLoading    } = useAdminStats();
  const { data: activityData,  isLoading: activityLoading } = useOverviewActivity();
  const { data: alertsData                                } = useOverviewAlerts();

  const activity     = activityData?.events  ?? [];
  const alerts       = alertsData?.alerts    ?? [];
  const banners      = alerts.filter(a => a.severity !== 'info');
  const statsLoading = overviewLoading || adminLoading;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const usersMax = adminStats
    ? Math.max(adminStats.users.investors, adminStats.users.contractors, 1)
    : 1;

  const jobsMax = adminStats
    ? Math.max(
        adminStats.jobs.open, adminStats.jobs.awarded,
        adminStats.jobs.inProgress, adminStats.jobs.completed,
        adminStats.jobs.cancelled, 1,
      )
    : 1;

  return (
    <div>

      {/* ── 1. Alert banners ──────────────────────────────────────────────── */}
      {banners.length > 0 && (
        <div className={styles.banners}>
          {banners.map((a, i) => (
            <div
              key={i}
              className={`${styles.banner} ${
                a.severity === 'critical' ? styles.bannerCritical : styles.bannerWarning
              }`}
            >
              <AlertTriangle size={14} className={styles.bannerIconSvg} />
              <span className={styles.bannerMsg}>{a.message}</span>
              <Link to={a.link} className={styles.bannerLink}>Investigate →</Link>
            </div>
          ))}
        </div>
      )}

      {/* ── 2. Page header ────────────────────────────────────────────────── */}
      <AdminPageHeader
        title="Platform Overview"
        subtitle={
          lastUpdated
            ? `Last updated ${lastUpdated} • Auto-refreshes every 60s`
            : 'Loading…'
        }
      />

      {/* ── 3. Stat cards — row 1 ─────────────────────────────────────────── */}
      <div className={styles.statGrid}>
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : (
            <>
              <AdminStatCard
                label="Total Users"
                value={adminStats    ? fmt(adminStats.users.total)                        : '—'}
                icon={<Users size={16} />}
                delta={overviewStats?.users.newToday}
              />
              <AdminStatCard
                label="Total Jobs"
                value={adminStats    ? fmt(adminStats.jobs.total)                         : '—'}
                icon={<Briefcase size={16} />}
              />
              <AdminStatCard
                label="Funds in Escrow"
                value={overviewStats ? fmtMoney(overviewStats.finance.fundsInEscrow)      : '—'}
                icon={<DollarSign size={16} />}
              />
              <AdminStatCard
                label="Revenue This Month"
                value={overviewStats ? fmtMoney(overviewStats.finance.platformRevenueThisMonth) : '—'}
                icon={<TrendingUp size={16} />}
              />
            </>
          )
        }
      </div>

      {/* ── 4. Stat cards — row 2 ─────────────────────────────────────────── */}
      <div className={`${styles.statGrid} ${styles.statGridMb}`}>
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : (
            <>
              <AdminStatCard
                label="Open Jobs"
                value={adminStats    ? fmt(adminStats.jobs.open)                          : '—'}
                icon={<Briefcase size={16} />}
              />
              <AdminStatCard
                label="Open Disputes"
                value={adminStats    ? fmt(adminStats.disputes.open)                      : '—'}
                icon={<Scale size={16} />}
              />
              <AdminStatCard
                label="New Users Today"
                value={overviewStats ? fmt(overviewStats.users.newToday)                  : '—'}
                icon={<UserPlus size={16} />}
              />
              <AdminStatCard
                label="Completed This Month"
                value={overviewStats ? fmt(overviewStats.jobs.completedThisMonth)         : '—'}
                icon={<CheckCircle size={16} />}
              />
            </>
          )
        }
      </div>

      {/* ── 5. Two-column section ──────────────────────────────────────────── */}
      <div className={styles.twoCol}>

        {/* Left (60%): live activity feed */}
        <section className={styles.colLeft}>
          <h2 className={styles.sectionTitle}>Live Activity Feed</h2>
          <div className={styles.feed}>
            {activityLoading ? (
              Array.from({ length: 8 }).map((_, i) => <FeedSkeleton key={i} />)
            ) : activity.length ? (
              activity.map((item, i) => (
                <div key={i} className={styles.feedItem}>
                  <span className={`${styles.feedIconWrap} ${feedIconCls(item.type as EventType)}`}>
                    {feedIcon(item.type as EventType)}
                  </span>
                  <div className={styles.feedBody}>
                    <span className={styles.feedDesc}>{item.description}</span>
                    <Link to={`/admin/users/${item.userId}`} className={styles.feedUser}>
                      {item.userName}
                    </Link>
                  </div>
                  <span className={styles.feedTime}>{timeAgo(item.createdAt)}</span>
                </div>
              ))
            ) : (
              <p className={styles.empty}>No activity in last 24 hours</p>
            )}
          </div>
        </section>

        {/* Right (40%): quick breakdown */}
        <section className={styles.colRight}>

          <h2 className={styles.sectionTitle}>Users</h2>
          <div className={styles.breakdownCard}>
            {adminStats ? (
              <>
                <BarRow label="Investors"   value={adminStats.users.investors}   max={usersMax} barCls={styles.barBlue}  />
                <BarRow label="Contractors" value={adminStats.users.contractors} max={usersMax} barCls={styles.barNavy} />
              </>
            ) : (
              <>
                <div className={`${styles.skelLine} ${styles.skelFull}`} />
                <div className={`${styles.skelLine} ${styles.skelFull}`} style={{ marginTop: 12 }} />
              </>
            )}
          </div>

          <h2 className={`${styles.sectionTitle} ${styles.sectionTitleMt}`}>Jobs by Status</h2>
          <div className={styles.breakdownCard}>
            {adminStats ? (
              <>
                <BarRow label="Open"        value={adminStats.jobs.open}        max={jobsMax} barCls={styles.barGreen}  />
                <BarRow label="In Progress" value={adminStats.jobs.inProgress}  max={jobsMax} barCls={styles.barAmber}  />
                <BarRow label="Awarded"     value={adminStats.jobs.awarded}     max={jobsMax} barCls={styles.barSky}    />
                <BarRow label="Completed"   value={adminStats.jobs.completed}   max={jobsMax} barCls={styles.barSlate}  />
                <BarRow label="Cancelled"   value={adminStats.jobs.cancelled}   max={jobsMax} barCls={styles.barRed}    />
              </>
            ) : (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`${styles.skelLine} ${styles.skelFull}`} style={{ marginTop: i > 0 ? 10 : 0 }} />
              ))
            )}
          </div>

        </section>
      </div>
    </div>
  );
}
