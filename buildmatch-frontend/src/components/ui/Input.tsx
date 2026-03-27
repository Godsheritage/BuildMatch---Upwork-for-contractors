import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className, type, ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className={styles.wrapper}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <div className={isPassword ? styles.inputWrap : undefined}>
        <input
          id={id}
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          className={[
            styles.input,
            isPassword ? styles.inputHasToggle : undefined,
            error ? styles.hasError : undefined,
            className,
          ].filter(Boolean).join(' ')}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword
              ? <EyeOff size={16} strokeWidth={1.75} />
              : <Eye    size={16} strokeWidth={1.75} />
            }
          </button>
        )}
      </div>
      {error && <span className={styles.errorMsg}>{error}</span>}
    </div>
  );
}
