interface ReliabilityScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function scoreColor(score: number): string {
  if (score >= 80) return '#0F6E56';
  if (score >= 60) return '#1D9E75';
  if (score >= 40) return '#B45309';
  return '#DC2626';
}

// SVG arc progress for lg size
function ArcProgress({ score, color, size }: { score: number; color: string; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);

  return (
    <svg
      width={size}
      height={size}
      style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={3}
      />
      {/* Progress */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

export function ReliabilityScoreBadge({ score, size = 'md' }: ReliabilityScoreBadgeProps) {
  const color = scoreColor(score);

  if (size === 'sm') {
    return (
      <span
        title="BuildMatch Reliability Score"
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          width:          24,
          height:         24,
          borderRadius:   '50%',
          background:     color,
          color:          '#fff',
          fontSize:       10,
          fontWeight:     600,
          letterSpacing:  '-0.02em',
          flexShrink:     0,
          userSelect:     'none',
        }}
      >
        {score}
      </span>
    );
  }

  if (size === 'md') {
    return (
      <div
        style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           4,
        }}
      >
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          40,
            height:         40,
            borderRadius:   '50%',
            background:     color,
            color:          '#fff',
            fontSize:       14,
            fontWeight:     600,
            letterSpacing:  '-0.02em',
          }}
        >
          {score}
        </div>
        <span
          style={{
            fontSize:      10,
            fontWeight:    500,
            color:         'var(--color-text-muted)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          Reliability
        </span>
      </div>
    );
  }

  // lg — 64px with SVG arc
  const outerSize = 64;
  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           8,
      }}
    >
      <div style={{ position: 'relative', width: outerSize, height: outerSize }}>
        <ArcProgress score={score} color={color} size={outerSize} />
        <div
          style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize:     20,
              fontWeight:   600,
              color,
              lineHeight:   1,
              letterSpacing: '-0.03em',
            }}
          >
            {score}
          </span>
          <span
            style={{
              fontSize:     9,
              fontWeight:   500,
              color:        'var(--color-text-muted)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginTop:    2,
            }}
          >
            /100
          </span>
        </div>
      </div>
      <span
        style={{
          fontSize:      11,
          fontWeight:    500,
          color:         'var(--color-text-muted)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Reliability Score
      </span>
    </div>
  );
}
