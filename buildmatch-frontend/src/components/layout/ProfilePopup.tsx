import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, TrendingUp, CreditCard, Briefcase, Settings,
  LogOut, Sun, Moon, ChevronRight, Circle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../ui/Avatar';
import styles from './ProfilePopup.module.css';

interface ProfilePopupProps {
  open:    boolean;
  onClose: () => void;
}

export function ProfilePopup({ open, onClose }: ProfilePopupProps) {
  const { user, logout }               = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate                       = useNavigate();
  const popupRef                       = useRef<HTMLDivElement>(null);
  const [online, setOnline]            = useState(true);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onClose]);

  if (!open || !user) return null;

  const isContractor = user.role === 'CONTRACTOR';

  function go(path: string) {
    onClose();
    navigate(path);
  }

  function handleLogout() {
    onClose();
    logout();
    navigate('/login');
  }

  const roleLabel = user.role.charAt(0) + user.role.slice(1).toLowerCase();

  return (
    <div ref={popupRef} className={styles.popup} role="menu">
      {/* Header */}
      <div className={styles.header}>
        <Avatar name={`${user.firstName} ${user.lastName}`} size="md" />
        <div className={styles.headerInfo}>
          <p className={styles.headerName}>{user.firstName} {user.lastName}</p>
          <p className={styles.headerRole}>{roleLabel}</p>
        </div>
      </div>

      {/* Online toggle */}
      <div className={styles.onlineRow}>
        <Circle
          size={8}
          fill={online ? '#0F6E56' : '#9CA3AF'}
          color={online ? '#0F6E56' : '#9CA3AF'}
          strokeWidth={0}
        />
        <span className={styles.onlineLabel}>
          {online ? 'Online' : 'Offline'}
        </span>
        <button
          className={`${styles.toggle} ${online ? styles.toggleOn : ''}`}
          onClick={() => setOnline((v) => !v)}
          role="switch"
          aria-checked={online}
        >
          <span className={styles.toggleThumb} />
        </button>
      </div>

      <div className={styles.divider} />

      {/* Navigation group 1 */}
      <div className={styles.group}>
        <PopupItem icon={User}       label="Your profile"    onClick={() => go('/dashboard/profile')} />
        <PopupItem icon={TrendingUp} label="Stats & trends"  onClick={() => go('/dashboard')} />
      </div>

      <div className={styles.divider} />

      {/* Navigation group 2 — role-aware */}
      <div className={styles.group}>
        {isContractor ? (
          <PopupItem icon={CreditCard} label="Payment setup" onClick={() => go('/dashboard/payments')} />
        ) : (
          <PopupItem icon={Briefcase} label="My jobs"        onClick={() => go('/dashboard/jobs')} />
        )}
        <PopupItem icon={Settings} label="Account settings"  onClick={() => go('/dashboard/profile')} />
      </div>

      <div className={styles.divider} />

      {/* Theme toggle row */}
      <button
        className={styles.themeRow}
        onClick={toggleTheme}
      >
        {theme === 'dark'
          ? <Sun  size={15} strokeWidth={1.75} />
          : <Moon size={15} strokeWidth={1.75} />}
        <span className={styles.themeLabel}>
          Theme: {theme === 'dark' ? 'Dark' : 'Light'}
        </span>
        <ChevronRight size={13} strokeWidth={2} className={styles.themeChevron} />
      </button>

      <div className={styles.divider} />

      {/* Log out */}
      <button className={styles.logoutRow} onClick={handleLogout}>
        <LogOut size={15} strokeWidth={1.75} />
        Log out
      </button>
    </div>
  );
}

// ── Popup item ────────────────────────────────────────────────────────────────

function PopupItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={styles.item} onClick={onClick} role="menuitem">
      <Icon size={15} strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}
