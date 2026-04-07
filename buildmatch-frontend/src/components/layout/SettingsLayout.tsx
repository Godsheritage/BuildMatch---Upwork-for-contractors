import { NavLink, Outlet } from 'react-router-dom';
import { User, Lock, Bell, BadgeCheck, ShieldAlert, CreditCard } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getDisputeSummary } from '../../services/dispute.service';
import styles from './SettingsLayout.module.css';

const NAV_ITEMS = [
  { to: '/dashboard/settings/personal',      icon: User,        label: 'Profile',        badge: false },
  { to: '/dashboard/settings/security',      icon: Lock,        label: 'Security',       badge: false },
  { to: '/dashboard/settings/notifications', icon: Bell,        label: 'Notifications',  badge: false },
  { to: '/dashboard/settings/verification',  icon: BadgeCheck,  label: 'Verification',   badge: false },
] as const;

const DISPUTE_ITEM = {
  to:    '/dashboard/settings/disputes',
  icon:  ShieldAlert,
  label: 'Dispute Centre',
};

const BILLING_ITEM = {
  to:    '/dashboard/settings/billing',
  icon:  CreditCard,
  label: 'Billing',
};

export function SettingsLayout() {
  const { data: summary } = useQuery({
    queryKey:        ['disputes', 'summary'],
    queryFn:         getDisputeSummary,
    refetchInterval: 120_000,
    staleTime:       60_000,
  });

  const openCount = summary?.active ?? 0;

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <nav className={styles.nav}>

          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}

          <div className={styles.divider} />

          <NavLink
            to={DISPUTE_ITEM.to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <DISPUTE_ITEM.icon size={16} strokeWidth={1.75} />
            {DISPUTE_ITEM.label}
            {openCount > 0 && (
              <span className={styles.badge}>{openCount > 99 ? '99+' : openCount}</span>
            )}
          </NavLink>

          <div className={styles.divider} />

          <NavLink
            to={BILLING_ITEM.to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
          >
            <BILLING_ITEM.icon size={16} strokeWidth={1.75} />
            {BILLING_ITEM.label}
          </NavLink>

        </nav>
      </aside>

      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}
