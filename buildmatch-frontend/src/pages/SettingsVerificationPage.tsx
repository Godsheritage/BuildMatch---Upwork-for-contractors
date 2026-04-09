import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, CheckCircle2, BadgeCheck, FileText, Mail, Phone, Clock, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import * as authService from '../services/auth.service';
import { Button } from '../components/ui/Button';
import styles from './SettingsSubPage.module.css';

type IdStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export function SettingsVerificationPage() {
  const { user }                        = useAuth();
  const { toast }                       = useToast();
  const navigate                        = useNavigate();

  const [sendingEmail, setSendingEmail] = useState(false);

  if (!user) return null;

  const emailVerified  = !!user.emailVerifiedAt;
  const phoneVerified  = !!user.phoneVerifiedAt;
  const idStatus: IdStatus =
    (user.idVerificationStatus as IdStatus | null) ?? (user.idDocumentUrl ? 'PENDING' : 'NONE');
  const idVerified = idStatus === 'APPROVED';

  const steps = [
    {
      key:   'email',
      icon:  Mail,
      title: 'Email verification',
      desc:  'Confirm your email address to secure your account.',
      done:  emailVerified,
    },
    {
      key:   'phone',
      icon:  Phone,
      title: 'Phone verification',
      desc:  'Add a verified phone number to increase your trust score.',
      done:  phoneVerified,
    },
    {
      key:   'id',
      icon:  FileText,
      title: 'Government ID',
      desc:  'Upload a government-issued ID to become fully verified.',
      done:  idVerified,
    },
  ] as const;

  const doneCount = steps.filter((s) => s.done).length;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSendVerificationEmail() {
    setSendingEmail(true);
    try {
      await authService.requestEmailVerification();
      toast("We've emailed you a verification link. Check your inbox.");
    } catch {
      toast('Could not send verification email. Please try again.', 'error');
    } finally {
      setSendingEmail(false);
    }
  }

  function handleStartIdFlow() {
    navigate('/dashboard/settings/verification/id');
  }

  // ── Render ──────────────────────────────────────────────────────────────────

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
            {doneCount}/{steps.length} steps complete
          </p>
          <p className={styles.verifyDesc}>
            Complete all verification steps to earn the Verified badge on your profile —
            this significantly increases your credibility with{' '}
            {user.role === 'CONTRACTOR' ? 'investors' : 'contractors'}.
          </p>
          {doneCount > 0 && (
            <ul className={styles.stepList}>
              {steps.filter((s) => s.done).map((s) => (
                <li key={s.title} className={styles.stepItem}>
                  <CheckCircle2 size={13} strokeWidth={2.5} />
                  {s.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className={styles.card}>
        <p className={styles.sectionTitle}>Verification steps</p>

        {/* Email */}
        <div className={styles.infoRow}>
          <div className={styles.infoRowLeft}>
            <p className={styles.infoRowLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={14} strokeWidth={1.75} />
              Email verification
            </p>
            <p className={styles.infoRowValue}>
              {emailVerified
                ? `Verified — ${user.email}`
                : `We'll send a one-time link to ${user.email}.`}
            </p>
          </div>
          {emailVerified ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-accent)', fontWeight: 500 }}>
              <CheckCircle2 size={14} strokeWidth={2.5} />
              Verified
            </span>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSendVerificationEmail}
              disabled={sendingEmail}
            >
              {sendingEmail ? 'Sending…' : 'Send link'}
            </Button>
          )}
        </div>

        {/* Phone */}
        <div className={styles.infoRow}>
          <div className={styles.infoRowLeft}>
            <p className={styles.infoRowLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Phone size={14} strokeWidth={1.75} />
              Phone verification
            </p>
            <p className={styles.infoRowValue}>
              SMS verification is rolling out soon. We'll notify you when it's available.
            </p>
          </div>
          <Button variant="secondary" size="sm" disabled>
            Coming soon
          </Button>
        </div>

        {/* ID document */}
        <div className={styles.infoRow}>
          <div className={styles.infoRowLeft}>
            <p className={styles.infoRowLabel} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={14} strokeWidth={1.75} />
              Government ID
            </p>
            <p className={styles.infoRowValue}>
              {idStatus === 'APPROVED' && 'Your ID has been verified.'}
              {idStatus === 'PENDING' && 'Document received. Our team is reviewing it.'}
              {idStatus === 'REJECTED' && (
                <>
                  Your previous submission was rejected.
                  {user.idVerificationNote ? ` Reason: ${user.idVerificationNote}` : ''} You can upload a new one.
                </>
              )}
              {idStatus === 'NONE' && 'Upload a JPG / PNG / PDF of your driver\'s license, passport, or state ID. Max 10 MB.'}
            </p>
          </div>
          {idStatus === 'APPROVED' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-accent)', fontWeight: 500 }}>
              <CheckCircle2 size={14} strokeWidth={2.5} />
              Verified
            </span>
          ) : idStatus === 'PENDING' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-warning)', fontWeight: 500 }}>
              <Clock size={14} strokeWidth={2.5} />
              Pending review
            </span>
          ) : (
            <Button variant="secondary" size="sm" onClick={handleStartIdFlow}>
              {idStatus === 'REJECTED' ? 'Re-verify' : 'Verify'}
            </Button>
          )}
        </div>

        {idStatus === 'REJECTED' && user.idVerificationNote && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              padding: '10px 14px',
              background: '#FEF2F2',
              border: '1px solid #FEE2E2',
              borderRadius: 8,
              marginTop: 12,
              fontSize: 13,
              color: 'var(--color-danger)',
            }}
          >
            <AlertTriangle size={14} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>{user.idVerificationNote}</span>
          </div>
        )}
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
