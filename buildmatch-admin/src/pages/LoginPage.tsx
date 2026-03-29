import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { ShieldAlert } from 'lucide-react';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [pending,  setPending]  = useState(false);
  const [error,    setError]    = useState('');

  // Already logged in as admin — redirect
  if (!isLoading && user?.role === 'ADMIN') {
    navigate('/admin', { replace: true });
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await login(email, password);
      // AuthProvider will update user; AdminRoute will redirect if not ADMIN
      navigate('/admin', { replace: true });
    } catch {
      setError('Invalid email or password.');
      toast('Login failed', 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <ShieldAlert size={22} className={styles.brandIcon} />
          <span className={styles.brandText}>BuildMatch Admin</span>
        </div>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Admin access only. Your account must have the ADMIN role.</p>

        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@example.com"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className={styles.btn} disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
