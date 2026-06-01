import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Loader2, Building2, HardHat, TrendingUp } from 'lucide-react';
import api from '../services/api';
import styles from './ComingSoonPage.module.css';

const TARGET = new Date('2026-07-01T00:00:00');

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(): TimeLeft {
  const diff = Math.max(0, TARGET.getTime() - Date.now());
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function ComingSoonPage() {
  const [timeLeft, setTimeLeft]   = useState<TimeLeft>(calcTimeLeft);
  const [role, setRole]           = useState<'INVESTOR' | 'CONTRACTOR' | null>(null);
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(calcTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/waitlist', { name: name.trim(), email: email.trim(), ...(role && { role }) });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [name, email]);

  return (
    <div className={styles.page}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <Building2 size={22} />
        </div>
        <span className={styles.logoText}>BuildMatch</span>
      </div>

      {/* Headline */}
      <h1 className={styles.headline}>Something big is coming.</h1>
      <p className={styles.subheadline}>
        The smartest way to connect real-estate investors with licensed contractors —
        launching&nbsp;<strong style={{ color: '#fff' }}>July&nbsp;1st</strong>.
      </p>

      {/* Countdown */}
      <div className={styles.countdown}>
        <div className={styles.countUnit}>
          <div className={styles.countBox}>{pad(timeLeft.days)}</div>
          <span className={styles.countLabel}>Days</span>
        </div>
        <span className={styles.countSep}>:</span>
        <div className={styles.countUnit}>
          <div className={styles.countBox}>{pad(timeLeft.hours)}</div>
          <span className={styles.countLabel}>Hours</span>
        </div>
        <span className={styles.countSep}>:</span>
        <div className={styles.countUnit}>
          <div className={styles.countBox}>{pad(timeLeft.minutes)}</div>
          <span className={styles.countLabel}>Min</span>
        </div>
        <span className={styles.countSep}>:</span>
        <div className={styles.countUnit}>
          <div className={styles.countBox}>{pad(timeLeft.seconds)}</div>
          <span className={styles.countLabel}>Sec</span>
        </div>
      </div>

      {/* Form or success */}
      <div className={styles.formWrap}>
        {submitted ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>
              <CheckCircle2 size={26} />
            </div>
            <p className={styles.successTitle}>You're on the list!</p>
            <p className={styles.successSub}>
              We'll send you an email the moment BuildMatch goes live on July 1st. Stay tuned.
            </p>
          </div>
        ) : (
          <>
            <p className={styles.formTitle}>Be the first to know.</p>
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.roleRow}>
                <button
                  type="button"
                  className={`${styles.roleCard} ${role === 'INVESTOR' ? styles.roleCardActive : ''}`}
                  onClick={() => setRole('INVESTOR')}
                >
                  <TrendingUp size={22} />
                  <span className={styles.roleCardTitle}>I'm an Investor</span>
                  <span className={styles.roleCardSub}>I hire contractors for my properties</span>
                </button>
                <button
                  type="button"
                  className={`${styles.roleCard} ${role === 'CONTRACTOR' ? styles.roleCardActive : ''}`}
                  onClick={() => setRole('CONTRACTOR')}
                >
                  <HardHat size={22} />
                  <span className={styles.roleCardTitle}>I'm a Contractor</span>
                  <span className={styles.roleCardSub}>I find and bid on renovation jobs</span>
                </button>
              </div>
              <input
                className={styles.input}
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="given-name"
              />
              <input
                className={styles.input}
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading || !name.trim() || !email.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Joining…
                  </>
                ) : (
                  'Join the Waitlist →'
                )}
              </button>
              {error && <p className={styles.errorMsg}>{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
