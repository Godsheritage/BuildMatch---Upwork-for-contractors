import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { forgotPassword } from '../services/auth.service';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import styles from './SettingsSubPage.module.css';

export function SettingsSecurityPage() {
  const { user }   = useAuth();
  const { toast }  = useToast();

  const [sending,    setSending]    = useState(false);
  const [emailSent,  setEmailSent]  = useState(false);

  if (!user) return null;

  async function handleResetPassword() {
    if (sending) return;
    setSending(true);
    try {
      await forgotPassword(user!.email);
      setEmailSent(true);
      toast('Password reset email sent — check your inbox.', 'success');
    } catch {
      toast('Could not send reset email. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  }

  const joinedDate = new Date(user.createdAt ?? Date.now()).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  return (
    <div className={styles.page}>
      <Link to="/dashboard/settings" className={styles.back}>
        <ChevronLeft size={15} strokeWidth={2} />
        Account Settings
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Account security</h1>
        <p className={styles.subtitle}>Manage your password and account access settings.</p>
      </div>

      {/* Account info */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Account details</p>

        <div className={styles.infoRow}>
          <div className={styles.infoRowLeft}>
            <p className={styles.infoRowLabel}>Email address</p>
            <p className={styles.infoRowValue}>{user.email}</p>
          </div>
        </div>

        <div className={styles.infoRow}>
          <div className={styles.infoRowLeft}>
            <p className={styles.infoRowLabel}>Account role</p>
            <p className={styles.infoRowValue}>
              {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
            </p>
          </div>
        </div>

        <div className={styles.infoRow}>
          <div className={styles.infoRowLeft}>
            <p className={styles.infoRowLabel}>Member since</p>
            <p className={styles.infoRowValue}>{joinedDate}</p>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Password</p>

        <div className={styles.infoRow}>
          <div className={styles.infoRowLeft}>
            <p className={styles.infoRowLabel}>Password</p>
            <p className={styles.infoRowValue}>••••••••••••</p>
          </div>
          {emailSent ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--color-accent)', fontWeight: 500 }}>
              <CheckCircle2 size={14} strokeWidth={2.5} />
              Email sent
            </span>
          ) : (
            <button
              className={styles.infoRowAction}
              onClick={handleResetPassword}
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Change password'}
            </button>
          )}
        </div>

        <p className={styles.fieldHint}>
          We'll send a password reset link to <strong>{user.email}</strong>.
        </p>
      </div>

      {/* Security status */}
      <div className={styles.verifyCallout}>
        <div className={styles.verifyIcon}>
          <ShieldCheck size={20} strokeWidth={1.75} color="#166534" />
        </div>
        <div className={styles.verifyBody}>
          <p className={styles.verifyTitle}>Your account is secure</p>
          <p className={styles.verifyDesc}>
            Your account is protected. Keep your password strong and never share it with anyone.
          </p>
          <ul className={styles.stepList}>
            <li className={styles.stepItem}>
              <CheckCircle2 size={13} strokeWidth={2.5} />
              Email address confirmed
            </li>
            <li className={styles.stepItem}>
              <CheckCircle2 size={13} strokeWidth={2.5} />
              Account role verified
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
