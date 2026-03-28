import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

const PLATFORM_LINKS = [
  { label: 'Find Contractors', to: '/contractors' },
  { label: 'Post a Job',       to: '/dashboard/post-job' },
  { label: 'How It Works',    to: '/about' },
  { label: 'Sign In',         to: '/login' },
];

const CONTRACTOR_LINKS = [
  { label: 'Create Profile', to: '/register' },
  { label: 'Profile Setup',  to: '/dashboard/profile/setup' },
  { label: 'Browse Jobs',    to: '/dashboard/browse-jobs' },
];

const COMPANY_LINKS = [
  { label: 'About',           to: '/about' },
  { label: 'Privacy Policy',  to: '/terms' },
  { label: 'Terms of Service', to: '/terms' },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* Brand column */}
        <div className={styles.brand}>
          <span className={styles.wordmark}>BuildMatch</span>
          <p className={styles.tagline}>
            The smarter way to find and hire licensed construction contractors
            across the United States.
          </p>
        </div>

        {/* Link columns */}
        <div className={styles.col}>
          <p className={styles.colHead}>Platform</p>
          {PLATFORM_LINKS.map(({ label, to }) => (
            <Link key={label} to={to} className={styles.link}>{label}</Link>
          ))}
        </div>

        <div className={styles.col}>
          <p className={styles.colHead}>For Contractors</p>
          {CONTRACTOR_LINKS.map(({ label, to }) => (
            <Link key={label} to={to} className={styles.link}>{label}</Link>
          ))}
        </div>

        <div className={styles.col}>
          <p className={styles.colHead}>Company</p>
          {COMPANY_LINKS.map(({ label, to }) => (
            <Link key={label} to={to} className={styles.link}>{label}</Link>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className={styles.bottom}>
        <span>© {new Date().getFullYear()} BuildMatch, Inc. All rights reserved.</span>
        <span>Built for the construction industry.</span>
      </div>
    </footer>
  );
}
