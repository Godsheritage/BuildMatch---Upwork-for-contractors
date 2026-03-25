import React from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className, ...props }: InputProps) {
  return (
    <div className={styles.wrapper}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <input
        id={id}
        className={[styles.input, error ? styles.hasError : undefined, className].filter(Boolean).join(' ')}
        {...props}
      />
      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  );
}
