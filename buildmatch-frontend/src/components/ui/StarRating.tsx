import styles from './StarRating.module.css';

export interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
}

export function StarRating({ rating, maxStars = 5, size = 14 }: StarRatingProps) {
  const filled = Math.round(rating);
  return (
    <span className={styles.wrapper} style={{ fontSize: size }}>
      {Array.from({ length: maxStars }, (_, i) => (
        <span
          key={i}
          className={styles.star}
          style={{ color: i < filled ? 'var(--color-star)' : 'var(--color-border)' }}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
      <span className={styles.label}>{rating.toFixed(1)}</span>
    </span>
  );
}
