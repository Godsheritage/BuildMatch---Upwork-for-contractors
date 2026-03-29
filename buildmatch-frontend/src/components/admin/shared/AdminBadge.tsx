import styles from './AdminBadge.module.css';

type AdminBadgeVariant =
  | 'active' | 'open' | 'live'          // green
  | 'suspended' | 'pending'             // amber
  | 'banned' | 'cancelled'              // red
  | 'verified' | 'approved' | 'resolved' // teal
  | 'admin';                             // purple

const VARIANT_MAP: Record<AdminBadgeVariant, string> = {
  active:    styles.green,
  open:      styles.green,
  live:      styles.green,
  suspended: styles.amber,
  pending:   styles.amber,
  banned:    styles.red,
  cancelled: styles.red,
  verified:  styles.teal,
  approved:  styles.teal,
  resolved:  styles.teal,
  admin:     styles.purple,
};

interface AdminBadgeProps {
  variant: AdminBadgeVariant | string;
  label?: string;
}

export function AdminBadge({ variant, label }: AdminBadgeProps) {
  const cls = VARIANT_MAP[variant as AdminBadgeVariant] ?? styles.neutral;
  return (
    <span className={`${styles.badge} ${cls}`}>
      {label ?? variant}
    </span>
  );
}
