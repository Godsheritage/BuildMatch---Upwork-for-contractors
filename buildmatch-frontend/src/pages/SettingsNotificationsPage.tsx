import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import { getPreferences, updatePreferences, type NotifPreferences } from '../services/notification-prefs.service';
import styles from './SettingsSubPage.module.css';

const DEFAULT_PREFS: NotifPreferences = {
  messages:       true,
  bidActivity:    true,
  jobUpdates:     true,
  disputeUpdates: true,
  drawUpdates:    true,
};

const NOTIF_ROWS: { key: keyof NotifPreferences; label: string; desc: string }[] = [
  {
    key:   'messages',
    label: 'New messages',
    desc:  'When someone sends you a message in a conversation thread.',
  },
  {
    key:   'bidActivity',
    label: 'Bid activity',
    desc:  'When a bid is received, accepted, withdrawn, or rejected on a job.',
  },
  {
    key:   'jobUpdates',
    label: 'Job status updates',
    desc:  'When a job is awarded, cancelled, or completed.',
  },
  {
    key:   'disputeUpdates',
    label: 'Dispute updates',
    desc:  'When a dispute is filed against you, status changes, or a ruling is issued.',
  },
  {
    key:   'drawUpdates',
    label: 'Draw schedule updates',
    desc:  'When a draw schedule is approved, locked, requested, or released.',
  },
];

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${on ? styles.toggleOn : ''}`}
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      disabled={disabled}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

export function SettingsNotificationsPage() {
  const { toast } = useToast();
  const [prefs,   setPrefs]   = useState<NotifPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [dirty,   setDirty]   = useState(false);

  // Load real preferences on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getPreferences();
        if (!cancelled) setPrefs(p);
      } catch {
        if (!cancelled) toast('Could not load notification preferences.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  function toggle(key: keyof NotifPreferences) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const fresh = await updatePreferences(prefs);
      setPrefs(fresh);
      setDirty(false);
      toast('Notification preferences saved.', 'success');
    } catch {
      toast('Failed to save preferences. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <Link to="/dashboard/settings" className={styles.back}>
        <ChevronLeft size={15} strokeWidth={2} />
        Account Settings
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Notifications</h1>
        <p className={styles.subtitle}>
          Choose which notifications you want to receive. Changes apply to both in-app and email.
        </p>
      </div>

      <div className={styles.card}>
        <p className={styles.sectionTitle}>Activity</p>

        {NOTIF_ROWS.map(({ key, label, desc }) => (
          <div key={key} className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <p className={styles.toggleLabel}>{label}</p>
              <p className={styles.toggleDesc}>{desc}</p>
            </div>
            <Toggle on={prefs[key]} onToggle={() => toggle(key)} disabled={loading || saving} />
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={loading || saving || !dirty}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </div>
  );
}
