import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  Home, Search, Briefcase, PlusCircle,
  FileText, Menu, X,
  HelpCircle, Bell, Settings, ChevronUp, MessageSquare, Sparkles, ShieldAlert, BookMarked,
} from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getDisputeSummary } from '../../services/dispute.service';
import { getConversations } from '../../services/message.service';
import { useUnreadCount } from '../../hooks/useUnreadCount';
import { useMessageNotifications } from '../../hooks/useMessageNotifications';
import { useAuth } from '../../hooks/useAuth';
import { useSavedContractors } from '../../context/SavedContractorsContext';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LanguageContext';
import type { Lang } from '../../i18n/translations';
import { Avatar } from '../ui/Avatar';
import { HelpDrawer } from './HelpDrawer';
import { NotificationsPopup, useNotificationCount } from './NotificationsPopup';
import { ProfilePopup } from './ProfilePopup';
import { Footer } from './Footer';
import styles from './DashboardLayout.module.css';

export function DashboardLayout() {
  const { user }                       = useAuth();
  const { theme } = useTheme();
  const { lang, setLang, t }           = useLang();
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [helpOpen, setHelpOpen]         = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [profileOpen, setProfileOpen]   = useState(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const unreadCount = useNotificationCount();
  const { totalUnread } = useUnreadCount();
  useMessageNotifications();

  const { data: disputeSummary } = useQuery({
    queryKey:        ['disputes', 'summary'],
    queryFn:         getDisputeSummary,
    refetchInterval: 2 * 60 * 1000,
    staleTime:       2 * 60 * 1000,
  });
  const openDisputeCount = disputeSummary?.active ?? 0;

  // Prefetch conversations on layout mount so the Messages tab loads instantly
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['conversations'],
      queryFn:  getConversations,
      staleTime: 60_000,
    });
  }, [queryClient]);

  const { totalSaved } = useSavedContractors();

  const investorNav = [
    { to: '/dashboard',                   icon: Home,          label: t.nav.dashboard,       badge: 0                          },
    { to: '/dashboard/messages',          icon: MessageSquare, label: 'Messages',            badge: totalUnread                },
    { to: '/dashboard/scope-estimator',   icon: Sparkles,      label: 'AI Estimator',        badge: 0                          },
    { to: '/contractors',                 icon: Search,        label: t.nav.findContractors, badge: 0                          },
    { to: '/dashboard/saved',             icon: BookMarked,    label: 'Saved Contractors',   badge: totalSaved > 0 ? totalSaved : 0 },
    { to: '/dashboard/jobs',              icon: Briefcase,     label: t.nav.myJobs,          badge: 0                          },
    { to: '/dashboard/post-job',          icon: PlusCircle,    label: t.nav.postJob,         badge: 0                          },
  ];

  const contractorNav = [
    { to: '/dashboard',              icon: Home,           label: t.nav.dashboard,   badge: 0           },
    { to: '/dashboard/messages',     icon: MessageSquare,  label: 'Messages',        badge: totalUnread },
    { to: '/dashboard/browse-jobs',  icon: Search,         label: t.nav.browseJobs,  badge: 0           },
    { to: '/dashboard/my-bids',      icon: FileText,       label: t.nav.myBids,      badge: 0           },
  ];

  const navItems = user?.role === 'CONTRACTOR' ? contractorNav : investorNav;

  const closeSidebar = () => setSidebarOpen(false);

  const pillLeft = lang === 'en' ? '3px' : 'calc(50% + 1px)';

  return (
    <div data-theme={theme}>
    <div className={styles.layout}>
      {/* Mobile top bar */}
      <header className={styles.mobileHeader}>
        <button className={styles.hamburger} onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Menu size={22} strokeWidth={2} />
        </button>
        <img src="/logo.png" alt="BuildMatch" style={{ height: 'clamp(3.9rem, 6.6vw, 6rem)' }} />
        <Link
          to="/dashboard/messages"
          className={styles.mobileMsgBtn}
          onClick={closeSidebar}
          aria-label="Messages"
        >
          <MessageSquare size={20} strokeWidth={2} />
          {totalUnread > 0 && <span className={styles.mobileUnreadDot} />}
        </Link>
      </header>

      {/* Backdrop */}
      {sidebarOpen && <div className={styles.backdrop} onClick={closeSidebar} aria-hidden />}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link to="/"><img src="/logo.png" alt="BuildMatch" style={{ height: 'clamp(3.9rem, 6.6vw, 6rem)' }} /></Link>
          <button className={styles.closeBtn} onClick={closeSidebar} aria-label="Close menu">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <nav className={styles.nav}>
          {navItems.map(({ to, icon: Icon, label, badge }) => (
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
              {badge > 0 && (
                <span className={styles.navBadge}>{badge > 99 ? '99+' : badge}</span>
              )}
            </NavLink>
          ))}

          <div className={styles.navSectionDivider} />

          <NavLink
            to="/dashboard/settings/disputes"
            onClick={closeSidebar}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <ShieldAlert size={17} strokeWidth={1.75} />
            Disputes
            {openDisputeCount > 0 && (
              <span className={`${styles.navBadge} ${styles.navBadgeDanger}`}>
                {openDisputeCount > 99 ? '99+' : openDisputeCount}
              </span>
            )}
          </NavLink>
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
          <Link to="/dashboard/settings" onClick={closeSidebar} className={styles.utilityBtn} aria-label="Settings" title="Settings">
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

        {user && (
          <button
            className={styles.sidebarFooter}
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Open profile menu"
          >
            <Avatar name={`${user.firstName} ${user.lastName}`} size="sm" src={user.avatarUrl ?? undefined} />
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
        <Footer />
      </main>
    </div>
    </div>
  );
}
