import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'warning' | 'muted';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[variant]].join(' ')}>
      {children}
    </span>
  );
}
