interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

export function Spinner({ size = 'md' }: SpinnerProps) {
  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-border border-t-primary animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}
