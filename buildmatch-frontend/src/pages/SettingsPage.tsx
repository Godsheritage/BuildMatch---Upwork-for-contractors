import { Link } from 'react-router-dom';
import { User, UserCog, Lock, Bell, BadgeCheck, ChevronRight } from 'lucide-react';
import styles from './SettingsPage.module.css';

const STATIC_CARDS = [
  {
    to:    '/dashboard/profile',
    icon:  User,
    title: 'My profile',
    desc:  'View and manage your public profile, portfolio, and profile strength.',
    bg:    '#DBEAFE',
    color: '#1E40AF',
  },
  {
    to:    '/dashboard/settings/personal',
    icon:  UserCog,
    title: 'Profile settings',
    desc:  'Update your visibility, experience level, specialties, and account status.',
    bg:    '#EDE9FE',
    color: '#5B21B6',
  },
  {
    to:    '/dashboard/settings/security',
    icon:  Lock,
    title: 'Account security',
    desc:  'Update your password and manage additional security settings.',
    bg:    '#FEE2E2',
    color: '#991B1B',
  },
  {
    to:    '/dashboard/settings/notifications',
    icon:  Bell,
    title: 'Notifications',
    desc:  'Select the notifications you want—and how you\'d like to receive them.',
    bg:    '#FEF3C7',
    color: '#92400E',
  },
  {
    to:    '/dashboard/settings/verification',
    icon:  BadgeCheck,
    title: 'Identity verification',
    desc:  'Help BuildMatch maintain a safe and trustworthy marketplace.',
    bg:    '#D1FAE5',
    color: '#065F46',
  },
] as const;

export function SettingsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Account Settings</h1>
        <p className={styles.subtitle}>
          Manage your personal information, security, and account preferences.
        </p>
      </div>

      <div className={styles.grid}>
        {STATIC_CARDS.map(({ to, icon: Icon, title, desc, bg, color }) => (
          <Link key={to} to={to} className={styles.card}>
            <div className={styles.cardIcon} style={{ background: bg, color, borderColor: 'transparent' }}>
              <Icon size={20} strokeWidth={1.75} />
            </div>
            <div>
              <p className={styles.cardTitle}>{title}</p>
              <p className={styles.cardDesc}>{desc}</p>
            </div>
            <ChevronRight size={15} className={styles.cardChevron} strokeWidth={1.75} />
          </Link>
        ))}
      </div>
    </div>
  );
}
