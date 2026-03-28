import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import styles from './SettingsSubPage.module.css';

interface NotifPrefs {
  newMessage:      boolean;
  bidReceived:     boolean;
  bidAccepted:     boolean;
  jobUpdates:      boolean;
  marketingEmails: boolean;
  weeklyDigest:    boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  newMessage:      true,
  bidReceived:     true,
  bidAccepted:     true,
  jobUpdates:      true,
  marketingEmails: false,
  weeklyDigest:    false,
};

const NOTIF_ROWS: {
  key:   keyof NotifPrefs;
  label: string;
  desc:  string;
  group: 'activity' | 'marketing';
}[] = [
  {
    key:   'newMessage',
    label: 'New messages',
    desc:  'Receive notifications when someone sends you a message.',
    group: 'activity',
  },
  {
    key:   'bidReceived',
    label: 'Bid received',
    desc:  'Get notified when a contractor submits a bid on your job.',
    group: 'activity',
  },
  {
    key:   'bidAccepted',
    label: 'Bid accepted',
    desc:  'Get notified when an investor accepts your bid.',
    group: 'activity',
  },
  {
    key:   'jobUpdates',
    label: 'Job status updates',
    desc:  'Notifications for job status changes (awarded, completed, etc.).',
    group: 'activity',
  },
  {
    key:   'marketingEmails',
    label: 'Product updates & tips',
    desc:  'Occasional emails about new features and platform improvements.',
    group: 'marketing',
  },
  {
    key:   'weeklyDigest',
    label: 'Weekly digest',
    desc:  'A weekly summary of activity on your account.',
    group: 'marketing',
  },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${on ? styles.toggleOn : ''}`}
      onClick={onToggle}
      role="switch"
      aria-checked={on}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

export function SettingsNotificationsPage() {
  const { toast } = useToast();
  const [prefs,  setPrefs]  = useState<NotifPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  function toggle(key: keyof NotifPrefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    // Simulated save — no backend endpoint yet
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    toast('Notification preferences saved.', 'success');
    setTimeout(() => setSaved(false), 3000);
  }

  const activityRows  = NOTIF_ROWS.filter((r) => r.group === 'activity');
  const marketingRows = NOTIF_ROWS.filter((r) => r.group === 'marketing');

  return (
    <div className={styles.page}>
      <Link to="/dashboard/settings" className={styles.back}>
        <ChevronLeft size={15} strokeWidth={2} />
        Account Settings
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Notifications</h1>
        <p className={styles.subtitle}>
          Choose which notifications you want to receive and how.
        </p>
      </div>

      {/* Activity notifications */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Activity</p>

        {activityRows.map(({ key, label, desc }) => (
          <div key={key} className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <p className={styles.toggleLabel}>{label}</p>
              <p className={styles.toggleDesc}>{desc}</p>
            </div>
            <Toggle on={prefs[key]} onToggle={() => toggle(key)} />
          </div>
        ))}
      </div>

      {/* Marketing notifications */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Updates & marketing</p>

        {marketingRows.map(({ key, label, desc }) => (
          <div key={key} className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <p className={styles.toggleLabel}>{label}</p>
              <p className={styles.toggleDesc}>{desc}</p>
            </div>
            <Toggle on={prefs[key]} onToggle={() => toggle(key)} />
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        {saved && <span className={styles.savedNote}>Preferences saved</span>}
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save preferences'}
        </Button>
      </div>
    </div>
  );
}
