import { useState, useEffect } from 'react';
import styles from './Lightbox.module.css';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export interface LightboxProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function Lightbox({ images, initialIndex = 0, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(initialIndex);

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(images.length - 1, i + 1));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (images.length === 0) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <div className={styles.imgWrap} onClick={(e) => e.stopPropagation()}>
        <img
          src={images[idx]}
          alt={`Photo ${idx + 1}`}
          className={styles.img}
        />
      </div>

      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close"
      >
        <CloseIcon />
      </button>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowLeft}`}
        onClick={(e) => { e.stopPropagation(); prev(); }}
        disabled={idx === 0}
        aria-label="Previous photo"
      >
        <ChevronLeft />
      </button>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowRight}`}
        onClick={(e) => { e.stopPropagation(); next(); }}
        disabled={idx === images.length - 1}
        aria-label="Next photo"
      >
        <ChevronRight />
      </button>

      {images.length > 1 && (
        <div className={styles.counter}>
          {idx + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
