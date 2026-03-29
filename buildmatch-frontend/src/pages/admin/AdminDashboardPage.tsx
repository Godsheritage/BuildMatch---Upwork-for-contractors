import { Link } from 'react-router-dom';
import {
  Users, Briefcase, Scale, Wrench,
  TrendingUp, UserPlus, FileText, AlertTriangle,
} from 'lucide-react';
import { useAdminStats, useAdminActivity } from '../../hooks/useAdmin';
import styles from './AdminDashboardPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function activityIcon(type: string) {
  if (type === 'user_signup')   return <UserPlus  size={14} />;
  if (type === 'job_posted')    return <Briefcase size={14} />;
  if (type === 'dispute_filed') return <Scale     size={14} />;
  return <FileText size={14} />;
}

function activityColor(type: string) {
  if (type === 'user_signup')   return styles.activityUser;
  if (type === 'job_posted')    return styles.activityJob;
  if (type === 'dispute_filed') return styles.activityDispute;
  return '';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Skeleton stat card ────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className={styles.statCard}>
      <div className={`${styles.skelLine} ${styles.skelShort}`} />
      <div className={`${styles.skelLine} ${styles.skelBig}`}   />
      <div className={`${styles.skelLine} ${styles.skelShort}`} />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const { data: stats,    isLoading: statsLoading    } = useAdminStats();
  const { data: activity, isLoading: activityLoading } = useAdminActivity();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Platform Overview</h1>
        <p className={styles.subtitle}>Real-time snapshot of BuildMatch activity</p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────── */}
      <div className={styles.statsGrid}>
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)
        ) : stats ? (
          <>
            <Link to="/admin/users" className={styles.statCard}>
              <div className={styles.statLabel}><Users size={14} /> Total Users</div>
              <div className={styles.statValue}>{fmt(stats.users.total)}</div>
              <div className={styles.statSub}>+{stats.users.newLast7d} this week</div>
            </Link>

            <Link to="/admin/users?role=INVESTOR" className={styles.statCard}>
              <div className={styles.statLabel}><TrendingUp size={14} /> Investors</div>
              <div className={styles.statValue}>{fmt(stats.users.investors)}</div>
              <div className={styles.statSub}>{stats.users.contractors} contractors</div>
            </Link>

            <Link to="/admin/jobs" className={styles.statCard}>
              <div className={styles.statLabel}><Briefcase size={14} /> Total Jobs</div>
              <div className={styles.statValue}>{fmt(stats.jobs.total)}</div>
              <div className={styles.statSub}>{stats.jobs.open} open · {stats.jobs.inProgress} in progress</div>
            </Link>

            <Link to="/admin/jobs?status=COMPLETED" className={`${styles.statCard} ${styles.statCardGreen}`}>
              <div className={styles.statLabel}><FileText size={14} /> Completed Jobs</div>
              <div className={styles.statValue}>{fmt(stats.jobs.completed)}</div>
              <div className={styles.statSub}>{stats.jobs.awarded} awarded</div>
            </Link>

            <Link to="/admin/contractors" className={styles.statCard}>
              <div className={styles.statLabel}><Wrench size={14} /> Contractors</div>
              <div className={styles.statValue}>{fmt(stats.contractors.total)}</div>
              <div className={styles.statSub}>{stats.contractors.available} available · {stats.contractors.licenseVerified} verified</div>
            </Link>

            <Link to="/admin/disputes" className={`${styles.statCard} ${stats.disputes.open > 0 ? styles.statCardAmber : ''}`}>
              <div className={styles.statLabel}><Scale size={14} /> Disputes</div>
              <div className={styles.statValue}>{fmt(stats.disputes.total)}</div>
              <div className={styles.statSub}>
                {stats.disputes.open > 0
                  ? <><AlertTriangle size={11} /> {stats.disputes.open} open</>
                  : `${stats.disputes.resolved} resolved`
                }
              </div>
            </Link>
          </>
        ) : null}
      </div>

      {/* ── Job status breakdown ────────────────────────────── */}
      {stats && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Job Status Breakdown</h2>
          <div className={styles.breakdownRow}>
            {[
              { label: 'Open',        value: stats.jobs.open,       cls: styles.barOpen       },
              { label: 'Awarded',     value: stats.jobs.awarded,    cls: styles.barAwarded    },
              { label: 'In Progress', value: stats.jobs.inProgress, cls: styles.barInProgress },
              { label: 'Completed',   value: stats.jobs.completed,  cls: styles.barCompleted  },
              { label: 'Cancelled',   value: stats.jobs.cancelled,  cls: styles.barCancelled  },
            ].map(({ label, value, cls }) => (
              <div key={label} className={styles.breakdownItem}>
                <div className={styles.breakdownLabel}>{label}</div>
                <div className={styles.breakdownValue}>{value}</div>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.barFill} ${cls}`}
                    style={{ width: stats.jobs.total > 0 ? `${(value / stats.jobs.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent activity ─────────────────────────────────── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent Activity</h2>
        <div className={styles.activityList}>
          {activityLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.activitySkel}>
                <div className={`${styles.skelCircle}`} />
                <div style={{ flex: 1 }}>
                  <div className={`${styles.skelLine} ${styles.skelMed}`}  style={{ marginBottom: 4 }} />
                  <div className={`${styles.skelLine} ${styles.skelShort}`} />
                </div>
              </div>
            ))
          ) : activity?.length ? (
            activity.map((item, i) => (
              <div key={i} className={`${styles.activityItem} ${activityColor(item.type)}`}>
                <span className={styles.activityIconWrap}>{activityIcon(item.type)}</span>
                <div className={styles.activityBody}>
                  <span className={styles.activityLabel}>{item.label}</span>
                  <span className={styles.activityMeta}>{item.sublabel} · {timeAgo(item.createdAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className={styles.empty}>No recent activity.</p>
          )}
        </div>
      </div>
    </div>
  );
}
