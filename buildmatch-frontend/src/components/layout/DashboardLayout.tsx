import React, { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  Home,
  Search,
  Briefcase,
  PlusCircle,
  User,
  FileText,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../ui/Avatar';
import styles from './DashboardLayout.module.css';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

const INVESTOR_NAV: NavItem[] = [
  { to: '/dashboard',     icon: Home,       label: 'Dashboard'          },
  { to: '/contractors',   icon: Search,     label: 'Find Contractors'   },
  { to: '/my-jobs',       icon: Briefcase,  label: 'My Jobs'            },
  { to: '/post-job',      icon: PlusCircle, label: 'Post a Job'         },
];

const CONTRACTOR_NAV: NavItem[] = [
  { to: '/dashboard',     icon: Home,       label: 'Dashboard'          },
  { to: '/profile',       icon: User,       label: 'My Profile'         },
  { to: '/jobs',          icon: Search,     label: 'Browse Jobs'        },
  { to: '/my-bids',       icon: FileText,   label: 'My Bids'            },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = user?.role === 'CONTRACTOR' ? CONTRACTOR_NAV : INVESTOR_NAV;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className={styles.layout}>
      {/* Mobile top bar */}
      <header className={styles.mobileHeader}>
        <button
          className={styles.hamburger}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} strokeWidth={2} />
        </button>
        <span
          className={styles.wordmark}
          style={{ fontSize: '15px' }}
        >
          BuildMatch
        </span>
        <div style={{ width: 34 }} /> {/* balance hamburger */}
      </header>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className={styles.backdrop} onClick={closeSidebar} aria-hidden />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link to="/" className={styles.wordmark}>
            BuildMatch
          </Link>
          <button
            className={styles.closeBtn}
            onClick={closeSidebar}
            aria-label="Close menu"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <nav className={styles.nav}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <Icon size={17} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className={styles.sidebarFooter}>
            <Avatar
              name={`${user.firstName} ${user.lastName}`}
              size="sm"
            />
            <div className={styles.userInfo}>
              <p className={styles.userName}>
                {user.firstName} {user.lastName}
              </p>
              <p className={styles.userRole}>
                {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
              </p>
            </div>
            <button
              className={styles.logoutBtn}
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
