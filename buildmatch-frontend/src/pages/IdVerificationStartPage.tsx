import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Smartphone, Camera, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { getMe } from '../services/auth.service';
import * as idSvc from '../services/id-verification.service';
import styles from './SettingsSubPage.module.css';

type Stage = 'info' | 'qr' | 'done';

export function IdVerificationStartPage() {
  const navigate                  = useNavigate();
  const { toast }                 = useToast();
  const { updateUser }            = useAuth();
  const [stage, setStage]         = useState<Stage>('info');
  const [creating, setCreating]   = useState(false);
  const [mobileUrl, setMobileUrl] = useState<string>('');

  // Poll status while QR is showing.
  useEffect(() => {
    if (stage !== 'qr') return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await idSvc.getSessionStatus();
        if (cancelled) return;
        if (s.status === 'UPLOADED') {
          setStage('done');
          try { updateUser(await getMe()); } catch { /* non-fatal */ }
        } else if (s.status === 'EXPIRED') {
          toast('Your verification link expired. Generate a new one.', 'error');
          setStage('info');
        }
      } catch { /* keep polling */ }
    };
    const id = window.setInterval(tick, 3000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [stage, toast, updateUser]);

  async function startSession() {
    setCreating(true);
    try {
      const res = await idSvc.createSession();
      setMobileUrl(res.mobileUrl);
      setStage('qr');
    } catch {
      toast('Could not start verification. Please try again.', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.page}>
      <Link to="/dashboard/settings/verification" className={styles.back}>
        <ChevronLeft size={15} strokeWidth={2} />
        Identity verification
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Verify your identity</h1>
        <p className={styles.subtitle}>
          Verification is done on your phone using your camera. It only takes a minute.
        </p>
      </div>

      {stage === 'info' && (
        <>
          <div className={styles.card}>
            <p className={styles.sectionTitle}>How it works</p>
            <Step
              n={1}
              icon={<Smartphone size={16} strokeWidth={1.75} />}
              title="Continue on your phone"
              desc="Scan a QR code with your phone to securely hand off the next steps."
            />
            <Step
              n={2}
              icon={<Camera size={16} strokeWidth={1.75} />}
              title="Take a photo of your government-issued ID"
              desc="Passport, driver's license, or national ID. Make sure the whole document is in frame."
            />
            <Step
              n={3}
              icon={<Camera size={16} strokeWidth={1.75} />}
              title="Take a quick selfie"
              desc="We compare it to the photo on your ID to confirm you're you."
            />
            <Step
              n={4}
              icon={<ShieldCheck size={16} strokeWidth={1.75} />}
              title="We review and confirm"
              desc="Our team reviews your submission within 1 business day."
              last
            />
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: '#F8F7F5', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <ShieldCheck size={16} strokeWidth={1.75} style={{ marginTop: 1, flexShrink: 0, color: '#0F6E56' }} />
            <span>We encrypt your data and only share it with our review team. We never sell or share it with third parties.</span>
          </div>

          <Button variant="primary" onClick={startSession} disabled={creating}>
            {creating ? 'Preparing…' : 'Continue'}
          </Button>
        </>
      )}

      {stage === 'qr' && (
        <div className={styles.card} style={{ alignItems: 'center', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, padding: 28 }}>
          <p className={styles.sectionTitle} style={{ marginBottom: 0 }}>Verify on your phone</p>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 360, margin: 0 }}>
            Scan this QR code with your phone's camera to continue. Keep this window open — it'll
            update automatically when you're done.
          </p>

          <div style={{ padding: 18, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12 }}>
            <QRCodeSVG value={mobileUrl} size={220} level="M" />
          </div>

          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', wordBreak: 'break-all', maxWidth: 360, margin: 0 }}>
            Or open this on your phone:<br />
            <span style={{ color: 'var(--color-text-primary)' }}>{mobileUrl}</span>
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span className={styles.pulseDot} style={{ width: 8, height: 8, borderRadius: '50%', background: '#0F6E56', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
            Waiting for your phone…
          </div>

          <button
            type="button"
            onClick={startSession}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <RefreshCw size={12} strokeWidth={2} /> Generate a new code
          </button>
        </div>
      )}

      {stage === 'done' && (
        <div className={styles.card} style={{ alignItems: 'center', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, padding: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E8F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={28} strokeWidth={1.75} color="#0F6E56" />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--color-text-primary)' }}>Submitted for review</h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 380 }}>
            Thanks! Our team will review your documents within 1 business day. We'll email you when it's approved.
          </p>
          <Button variant="primary" onClick={() => navigate('/dashboard/settings/verification')}>
            Back to verification
          </Button>
        </div>
      )}
    </div>
  );
}

function Step({
  n, icon, title, desc, last,
}: { n: number; icon: React.ReactNode; title: string; desc: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'flex-start',
      paddingBottom: last ? 0 : 14,
      marginBottom: last ? 0 : 14,
      borderBottom: last ? 'none' : '1px solid var(--color-border)',
    }}>
      <div style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
        background: '#E8F4F0', color: '#0F6E56',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 600,
      }}>
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon} {title}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          {desc}
        </p>
      </div>
    </div>
  );
}
