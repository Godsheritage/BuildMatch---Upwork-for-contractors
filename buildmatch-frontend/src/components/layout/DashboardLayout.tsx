import { useState, useRef } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  Home, Search, Briefcase, PlusCircle,
  User, FileText, Menu, X, Moon, Sun,
  HelpCircle, Bell, Settings, ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LanguageContext';
import type { Lang } from '../../i18n/translations';
import { Avatar } from '../ui/Avatar';
import { HelpDrawer } from './HelpDrawer';
import { NotificationsPopup, useNotificationCount } from './NotificationsPopup';
import { ProfilePopup } from './ProfilePopup';
import styles from './DashboardLayout.module.css';

export function DashboardLayout() {
  const { user }                       = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { lang, setLang, t }           = useLang();
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [helpOpen, setHelpOpen]         = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [profileOpen, setProfileOpen]   = useState(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const unreadCount = useNotificationCount();

  const investorNav = [
    { to: '/dashboard',          icon: Home,       label: t.nav.dashboard       },
    { to: '/contractors',        icon: Search,     label: t.nav.findContractors  },
    { to: '/dashboard/jobs',     icon: Briefcase,  label: t.nav.myJobs          },
    { to: '/dashboard/post-job', icon: PlusCircle, label: t.nav.postJob         },
  ];

  const contractorNav = [
    { to: '/dashboard',  icon: Home,     label: t.nav.dashboard   },
    { to: '/dashboard/profile', icon: User, label: t.nav.myProfile },
    { to: '/dashboard/browse-jobs', icon: Search, label: t.nav.browseJobs },
    { to: '/dashboard/my-bids', icon: FileText, label: t.nav.myBids },
  ];

  const navItems = user?.role === 'CONTRACTOR' ? contractorNav : investorNav;

  const closeSidebar = () => setSidebarOpen(false);

  const pillLeft = lang === 'en' ? '3px' : 'calc(50% + 1px)';

  return (
    <div className={styles.layout}>
      {/* Mobile top bar */}
      <header className={styles.mobileHeader}>
        <button className={styles.hamburger} onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={22} strokeWidth={2} />
        </button>
        <span className={styles.wordmark} style={{ fontSize: '15px' }}>BuildMatch</span>
        <div style={{ width: 34 }} />
      </header>

      {/* Backdrop */}
      {sidebarOpen && <div className={styles.backdrop} onClick={closeSidebar} aria-hidden />}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link to="/" className={styles.wordmark}>BuildMatch</Link>
          <button className={styles.closeBtn} onClick={closeSidebar} aria-label="Close menu">
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

        {/* Utility icons */}
        <div className={styles.utilityRow}>
          <button
            className={styles.utilityBtn}
            onClick={() => setHelpOpen(true)}
            aria-label="Help"
            title="Help"
          >
            <HelpCircle size={17} strokeWidth={1.75} />
          </button>
          <button
            ref={notifBtnRef}
            className={styles.utilityBtn}
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
            title="Notifications"
            style={{ position: 'relative' }}
          >
            <Bell size={17} strokeWidth={1.75} />
            {unreadCount > 0 && (
              <span className={styles.notifBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
          <Link to="/dashboard/profile" onClick={closeSidebar} className={styles.utilityBtn} aria-label="Settings" title="Settings">
            <Settings size={17} strokeWidth={1.75} />
          </Link>
        </div>

        {/* Language slider */}
        <div className={styles.langSection}>
          <p className={styles.langLabel}>{t.sidebar.language}</p>
          <div
            className={styles.langSliderWrap}
            onClick={() => setLang(lang === 'en' ? 'es' : 'en' as Lang)}
            role="switch"
            aria-checked={lang === 'es'}
            aria-label="Toggle language"
          >
            <div className={styles.langSliderPill} style={{ left: pillLeft }} />
            <span className={`${styles.langOption} ${lang === 'en' ? styles.langOptionActive : ''}`}>EN</span>
            <span className={`${styles.langOption} ${lang === 'es' ? styles.langOptionActive : ''}`}>ES</span>
          </div>
        </div>

        {/* Theme toggle */}
        <button className={styles.themeToggleBtn} onClick={toggleTheme} aria-label="Toggle dark mode">
          {theme === 'dark' ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
          {theme === 'dark' ? t.sidebar.lightMode : t.sidebar.darkMode}
        </button>

        {user && (
          <button
            className={styles.sidebarFooter}
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Open profile menu"
          >
            <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" />
            <div className={styles.userInfo}>
              <p className={styles.userName}>{user.firstName} {user.lastName}</p>
              <p className={styles.userRole}>{user.role.charAt(0) + user.role.slice(1).toLowerCase()}</p>
            </div>
            <ChevronUp size={14} strokeWidth={2} className={`${styles.footerChevron} ${profileOpen ? styles.footerChevronOpen : ''}`} />
          </button>
        )}
      </aside>

      {/* Profile popup */}
      <ProfilePopup open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Help drawer */}
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Notifications popup */}
      <NotificationsPopup
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        anchorRef={notifBtnRef}
        unreadCount={unreadCount}
      />

      {/* Main content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
