import { useState } from 'react';
import styles from './ConfirmModal.module.css';
import { Button } from '../../ui';

type ModalVariant = 'danger' | 'warning' | 'primary';
interface ConfirmModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; variant?: ModalVariant; confirmPhrase?: string; isLoading?: boolean; }

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', confirmPhrase, isLoading }: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  if (!isOpen) return null;
  const canConfirm = !isLoading && (confirmPhrase === undefined || typed === confirmPhrase);
  function handleClose() { setTyped(''); onClose(); }
  function handleConfirm() { if (!canConfirm) return; setTyped(''); onConfirm(); }
  const btnVariant = variant === 'primary' ? 'primary' : 'danger';
  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={`${styles.title} ${styles[variant]}`}>{title}</h2>
        <p className={styles.message}>{message}</p>
        {confirmPhrase && (
          <div className={styles.phraseBlock}>
            <label className={styles.phraseLabel}>Type <strong>{confirmPhrase}</strong> to confirm</label>
            <input type="text" className={styles.phraseInput} value={typed} onChange={e => setTyped(e.target.value)} autoFocus placeholder={confirmPhrase} />
          </div>
        )}
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={isLoading}>Cancel</Button>
          <Button variant={btnVariant} size="sm" onClick={handleConfirm} disabled={!canConfirm}>{isLoading ? 'Processing…' : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
