import type { ReactNode } from 'react';
import styles from './AdminStatCard.module.css';

interface AdminStatCardProps { label: string; value: number | string; delta?: number; icon?: ReactNode; }

export function AdminStatCard({ label, value, delta, icon }: AdminStatCardProps) {
  return (
    <div className={styles.card}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <div className={styles.body}>
        <div className={styles.value}>{value}</div>
        <div className={styles.label}>{label}</div>
      </div>
      {delta !== undefined && (
        <div className={`${styles.delta} ${delta >= 0 ? styles.deltaPos : styles.deltaNeg}`}>
          {delta >= 0 ? '+' : ''}{delta}
        </div>
      )}
    </div>
  );
}
