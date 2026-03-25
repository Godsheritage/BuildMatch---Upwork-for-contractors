import styles from './Avatar.module.css';

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

export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const color = getAvatarColor(name);
  return (
    <div
      className={[styles.avatar, styles[size]].join(' ')}
      style={src ? undefined : { backgroundColor: color.bg, color: color.text }}
    >
      {src ? (
        <img src={src} alt={name} className={styles.img} />
      ) : (
        <span className={styles.initials}>{getInitials(name)}</span>
      )}
    </div>
  );
}
