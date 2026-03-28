import { Link } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, BadgeCheck, FileText, Mail, Phone } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import styles from './SettingsSubPage.module.css';

const STEPS = [
  {
    icon:  Mail,
    title: 'Email verification',
    desc:  'Confirm your email address to secure your account.',
    done:  true,
  },
  {
    icon:  Phone,
    title: 'Phone verification',
    desc:  'Add a phone number to increase your trust score.',
    done:  false,
  },
  {
    icon:  FileText,
    title: 'ID document',
    desc:  'Upload a government-issued ID to become fully verified.',
    done:  false,
  },
];

export function SettingsVerificationPage() {
  const { user } = useAuth();

  if (!user) return null;

  const doneCount = STEPS.filter((s) => s.done).length;

  return (
    <div className={styles.page}>
      <Link to="/dashboard/settings" className={styles.back}>
        <ChevronLeft size={15} strokeWidth={2} />
        Account Settings
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Identity verification</h1>
        <p className={styles.subtitle}>
          Verified accounts build more trust and get better opportunities on BuildMatch.
        </p>
      </div>

      {/* Status callout */}
      <div className={styles.verifyCallout}>
        <div className={styles.verifyIcon}>
          <BadgeCheck size={20} strokeWidth={1.75} color="#166534" />
        </div>
        <div className={styles.verifyBody}>
          <p className={styles.verifyTitle}>
            {doneCount}/{STEPS.length} steps complete
          </p>
          <p className={styles.verifyDesc}>
            Complete all verification steps to earn the Verified badge on your profile —
            this significantly increases your credibility with {user.role === 'CONTRACTOR' ? 'investors' : 'contractors'}.
          </p>
          <ul className={styles.stepList}>
            {STEPS.filter((s) => s.done).map((s) => (
              <li key={s.title} className={styles.stepItem}>
                <CheckCircle2 size={13} strokeWidth={2.5} />
                {s.title}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Steps */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Verification steps</p>

        {STEPS.map(({ icon: Icon, title, desc, done }) => (
          <div key={title} className={styles.infoRow}>
            <div className={styles.infoRowLeft}>
              <p className={styles.infoRowLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                {title}
              </p>
              <p className={styles.infoRowValue}>{desc}</p>
            </div>
            {done ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-accent)', fontWeight: 500, flexShrink: 0 }}>
                <CheckCircle2 size={14} strokeWidth={2.5} />
                Verified
              </span>
            ) : (
              <button className={styles.infoRowAction}>
                Start →
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Why verify */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Why verify your identity?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[
            'Verified accounts appear higher in search results',
            'Build trust with the other party before a job starts',
            'Unlock higher-value job opportunities',
            'Protect yourself and others from fraud',
          ].map((benefit) => (
            <div key={benefit} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <CheckCircle2 size={14} strokeWidth={2.5} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
