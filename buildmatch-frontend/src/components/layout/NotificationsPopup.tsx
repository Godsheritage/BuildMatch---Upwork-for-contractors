import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, MoreHorizontal, CheckCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '../../services/notification.service';
import type { Notification } from '../../services/notification.service';
import styles from './NotificationsPopup.module.css';

// ── Helpers ───────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TYPE_DOT: Record<Notification['type'], string> = {
  bid_received:  '#5B6CF8',
  bid_accepted:  '#0F6E56',
  bid_rejected:  '#DC2626',
  bid_withdrawn: '#BA7517',
  job_awarded:   '#0F6E56',
  job_cancelled: '#DC2626',
  job_completed: '#0F6E56',
};

// ── Props ─────────────────────────────────────────────

interface NotificationsPopupProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  unreadCount?: number;
}

export function NotificationsPopup({ open, onClose, anchorRef }: NotificationsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn:  getNotifications,
    staleTime: 60_000,
    enabled:   open,
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const unread = notifications.filter((n) => !n.read);

  return (
    <div ref={popupRef} className={styles.popup}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Notifications</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {unread.length > 0 && (
            <button className={styles.headerBtn} style={{ background: 'var(--color-primary)', color: '#fff', borderColor: 'transparent' }}>
              <CheckCheck size={12} strokeWidth={2.5} />
              Mark {unread.length} as read
            </button>
          )}
          <button className={styles.headerBtn}>View preferences</button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${styles.tabActive}`}>Unread {unread.length > 0 && `(${unread.length})`}</button>
        <button className={styles.tab}>All</button>
      </div>

      {/* List */}
      <div className={styles.list}>
        {isLoading ? (
          <div className={styles.loadingState}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonItem}>
                <div className={styles.skeletonBlock} style={{ width: 8, height: 8, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className={styles.skeletonBlock} style={{ height: 12, width: '80%', marginBottom: 6 }} />
                  <div className={styles.skeletonBlock} style={{ height: 10, width: '30%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <Bell size={28} color="var(--color-border)" strokeWidth={1.5} />
            <p>No notifications yet</p>
            <span>Activity from jobs and bids will appear here</span>
          </div>
        ) : (
          notifications.map((n) => (
            <Link
              key={n.id}
              to={`/jobs/${n.jobId}`}
              className={styles.item}
              onClick={onClose}
            >
              <div
                className={styles.dot}
                style={{ background: n.read ? 'transparent' : TYPE_DOT[n.type] ?? '#5B6CF8' }}
              />
              <div className={styles.itemBody}>
                <p className={`${styles.itemText} ${n.read ? styles.itemTextRead : ''}`}>
                  {n.message}
                </p>
                <p className={styles.itemDate}>{timeAgo(n.createdAt)}</p>
              </div>
              <button
                className={styles.moreBtn}
                onClick={(e) => e.preventDefault()}
                aria-label="More options"
              >
                <MoreHorizontal size={15} strokeWidth={2} />
              </button>
            </Link>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className={styles.footer}>
          <span className={styles.footerCount}>{unread.length} of {notifications.length} unread notifications</span>
          <button className={styles.viewAll}>View all</button>
        </div>
      )}
    </div>
  );
}

// ── Unread badge helper ───────────────────────────────

export function useNotificationCount() {
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn:  getNotifications,
    staleTime: 60_000,
  });
  return notifications.filter((n) => !n.read).length;
}
