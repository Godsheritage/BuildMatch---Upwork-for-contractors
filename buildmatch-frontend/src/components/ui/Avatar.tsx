import { useState } from 'react';
import styles from './Avatar.module.css';
import { getOptimizedUrl } from '../../utils/media';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}

const AVATAR_COLORS = [
  { bg: '#DBEAFE', text: '#1E40AF' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FEE2E2', text: '#991B1B' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#E0F2FE', text: '#0369A1' },
];

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('');
}

function getAvatarColor(name: string): { bg: string; text: string } {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

const SIZE_PX: Record<string, number> = { sm: 64, md: 96, lg: 192 };

export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const color = getAvatarColor(name);
  const showImg = src && !imgError;
  const optimizedSrc = src ? getOptimizedUrl(src, SIZE_PX[size] ?? 96) : undefined;
  return (
    <div
      className={[styles.avatar, styles[size]].join(' ')}
      style={showImg ? undefined : { backgroundColor: color.bg, color: color.text }}
    >
      {showImg ? (
        <img
          src={optimizedSrc}
          alt={name}
          className={styles.img}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={styles.initials}>{getInitials(name)}</span>
      )}
    </div>
  );
}
