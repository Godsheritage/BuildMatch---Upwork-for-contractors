import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wrench, Briefcase, Scale, FileSearch,
  Settings, Flag, CreditCard, ShieldAlert, BarChart2, Activity,
  MessageSquareWarning, Star, BadgeCheck, Bug,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getStats, getBugReportNewCount } from '../../services/admin.service';
import styles from './AdminLayout.module.css';

interface NavItem { to: string; icon: React.ElementType; label: string; end?: boolean; badgeKey?: 'disputes' | 'moderation' | 'bugs'; }

const NAV_ITEMS: NavItem[] = [
  { to: '/admin',             icon: LayoutDashboard,      label: 'Overview',      end: true },
  { to: '/admin/users',       icon: Users,                label: 'Users'                    },
  { to: '/admin/verifications', icon: BadgeCheck,         label: 'Verifications'            },
  { to: '/admin/bugs',        icon: Bug,                  label: 'Bug Reports',   badgeKey: 'bugs' },
  { to: '/admin/contractors', icon: Wrench,               label: 'Contractors'              },
  { to: '/admin/jobs',        icon: Briefcase,            label: 'Jobs'                     },
  { to: '/admin/disputes',    icon: Scale,                label: 'Disputes',      badgeKey: 'disputes' },
  { to: '/admin/finance',     icon: CreditCard,           label: 'Finance'                  },
  { to: '/admin/moderation',  icon: MessageSquareWarning, label: 'Moderation',    badgeKey: 'moderation' },
  { to: '/admin/reviews',     icon: Star,                 label: 'Reviews'                  },
  { to: '/admin/analytics',   icon: BarChart2,            label: 'Analytics'                },
  { to: '/admin/health',      icon: Activity,             label: 'Health'                   },
  { to: '/admin/audit',       icon: FileSearch,           label: 'Audit Log'                },
  { to: '/admin/settings',    icon: Settings,             label: 'Settings'                 },
  { to: '/admin/flags',       icon: Flag,                 label: 'Feature Flags'            },
];

interface BadgeCounts { disputes: number; moderation: number; bugs: number; }

function useBadgeCounts(): BadgeCounts {
  const [counts, setCounts] = useState<BadgeCounts>({ disputes: 0, moderation: 0, bugs: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchCounts() {
    try {
      const [stats, bugs] = await Promise.all([
        getStats(),
        getBugReportNewCount().catch(() => ({ newCount: 0 })),
      ]);
      setCounts({
        disputes:   stats.disputes?.open ?? 0,
        moderation: 0,
        bugs:       bugs.newCount ?? 0,
      });
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    fetchCounts();
    timerRef.current = setInterval(fetchCounts, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return counts;
}

export function AdminLayout() {
  const { user } = useAuth();
  const counts = useBadgeCounts();

  return (
    <div className={styles.shell}>
      <header className={styles.navbar}>
        <div className={styles.navbarLeft}>
          <ShieldAlert size={16} className={styles.navbarIcon} />
          <span className={styles.navbarWordmark}>BuildMatch Admin</span>
          <span className={styles.adminPill}>ADMIN</span>
        </div>
        <div className={styles.navbarRight}>
          {user && <span className={styles.navbarUser}>{user.firstName} {user.lastName}</span>}
          <Link to="/login" className={styles.exitLink} onClick={() => localStorage.removeItem('buildmatch_token')}>
            Sign out
          </Link>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ to, icon: Icon, label, end, badgeKey }) => {
            const badgeCount = badgeKey ? counts[badgeKey] : 0;
            return (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}>
                <Icon size={15} className={styles.navIcon} />
                <span className={styles.navLabel}>{label}</span>
                {badgeCount > 0 && <span className={styles.badge}>{badgeCount > 99 ? '99+' : badgeCount}</span>}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
