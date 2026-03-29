import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Wrench,
  Briefcase,
  Scale,
  FileSearch,
  Settings,
  Flag,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import styles from './AdminLayout.module.css';

// ── Nav definition ────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/admin',             icon: LayoutDashboard, label: 'Dashboard',   end: true  },
  { to: '/admin/users',       icon: Users,           label: 'Users'              },
  { to: '/admin/contractors', icon: Wrench,          label: 'Contractors'        },
  { to: '/admin/jobs',        icon: Briefcase,       label: 'Jobs'               },
  { to: '/admin/disputes',    icon: Scale,           label: 'Disputes'           },
  { to: '/admin/audit',       icon: FileSearch,      label: 'Audit Log'          },
  { to: '/admin/settings',    icon: Settings,        label: 'Settings'           },
  { to: '/admin/flags',       icon: Flag,            label: 'Feature Flags'      },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className={styles.shell}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <ShieldAlert size={18} className={styles.brandIcon} />
          <span className={styles.brandText}>Admin Portal</span>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <Icon size={16} className={styles.navIcon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.adminBadge}>
            <span className={styles.adminBadgeDot} />
            <span className={styles.adminBadgeName}>
              {user?.firstName} {user?.lastName}
            </span>
          </div>
          <button
            className={styles.backBtn}
            onClick={() => navigate('/dashboard')}
            title="Back to app"
          >
            <ArrowLeft size={14} />
            <span>Back to app</span>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
