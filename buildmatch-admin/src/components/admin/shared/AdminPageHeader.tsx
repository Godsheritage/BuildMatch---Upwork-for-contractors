import type { ReactNode } from 'react';
import styles from './AdminPageHeader.module.css';

interface AdminPageHeaderProps { title: string; subtitle?: string; actions?: ReactNode; }

export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
