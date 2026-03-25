import React from 'react';
import styles from './Card.module.css';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  hoverable?: boolean;
}

export function Card({ children, className, onClick, hoverable = false }: CardProps) {
  const cls = [styles.card, hoverable ? styles.hoverable : undefined, className].filter(Boolean).join(' ');
  return (
    <div className={cls} onClick={onClick}>
      {children}
    </div>
  );
}
