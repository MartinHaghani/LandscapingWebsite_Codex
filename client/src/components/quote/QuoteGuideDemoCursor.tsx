import type { QuoteGuideDemoPoint } from '../../lib/quoteGuideDemo';

interface QuoteGuideDemoCursorProps {
  point: QuoteGuideDemoPoint;
  variant?: 'default' | 'add-vertex';
  showClickPulse?: boolean;
  clickTone?: 'default' | 'danger';
}

export const QuoteGuideDemoCursor = ({
  point,
  variant = 'default',
  showClickPulse = false,
  clickTone = 'default'
}: QuoteGuideDemoCursorProps) => {
  const clickStroke = clickTone === 'danger' ? '#DC2626' : '#329F5B';

  return (
    <div
      className="absolute z-30 h-7 w-6"
      style={{
        left: `${point.x}px`,
        top: `${point.y}px`,
        transform: 'translate(-14px, -4px)'
      }}
    >
      <svg viewBox="0 0 30 30" className="h-full w-full overflow-visible">
        <defs>
          <filter id="quote-guide-demo-cursor-shadow" x="-80%" y="-80%" width="220%" height="220%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#101713" floodOpacity="0.35" />
          </filter>
        </defs>

        {showClickPulse ? (
          <g>
            <circle
              cx="16"
              cy="18"
              r="8"
              fill="none"
              stroke={clickStroke}
              strokeOpacity="0.82"
              strokeWidth="2.5"
            />
            <circle
              cx="16"
              cy="18"
              r="14"
              fill="none"
              stroke={clickStroke}
              strokeOpacity="0.28"
              strokeWidth="2.2"
            />
          </g>
        ) : null}

        <path
          d="M4.5 2.3 19.5 16.1l-6.3 1.2 3.4 6.3-3.8 2.1-3.4-6.4-4.3 4.4Z"
          fill="#FFFFFF"
          stroke="#1E2A22"
          strokeWidth="1.35"
          strokeLinejoin="round"
          filter="url(#quote-guide-demo-cursor-shadow)"
        />

        {variant === 'add-vertex' ? (
          <g>
            <circle cx="21.5" cy="6.5" r="5.5" fill="#FFFFFF" stroke="#DCFCE7" strokeWidth="1.8" />
            <path
              d="M21.5 3.9V9.1M18.9 6.5H24.1"
              stroke="#329F5B"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
};
