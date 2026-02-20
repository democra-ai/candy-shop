interface CandyIconProps {
  size?: number;
  className?: string;
  animate?: boolean;
  animationDelay?: string;
}

export function CandyIcon({ size = 24, className = '', animate = false, animationDelay }: CandyIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`${animate ? 'animate-candy-float' : ''} ${className}`}
      style={animationDelay ? { animationDelay } : undefined}
      aria-hidden="true"
    >
      {/* Left wrapper twist */}
      <path d="M8 50 Q15 42, 22 46 Q18 50, 22 54 Q15 58, 8 50Z" fill="#ff6b9d" opacity="0.9" />
      <path d="M8 50 Q15 44, 20 48" stroke="#e0558a" strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M8 50 Q15 56, 20 52" stroke="#e0558a" strokeWidth="1.5" fill="none" opacity="0.6" />
      {/* Right wrapper twist */}
      <path d="M92 50 Q85 42, 78 46 Q82 50, 78 54 Q85 58, 92 50Z" fill="#ff6b9d" opacity="0.9" />
      <path d="M92 50 Q85 44, 80 48" stroke="#e0558a" strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M92 50 Q85 56, 80 52" stroke="#e0558a" strokeWidth="1.5" fill="none" opacity="0.6" />
      {/* Candy body */}
      <ellipse cx="50" cy="50" rx="30" ry="22" fill="url(#cg)" stroke="#e0558a" strokeWidth="2" />
      {/* Candy stripes */}
      <path d="M32 38 Q40 58, 35 62" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M44 36 Q48 56, 44 64" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M56 36 Q56 56, 54 64" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M67 38 Q64 56, 65 62" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Shine highlight */}
      <ellipse cx="42" cy="42" rx="10" ry="6" fill="rgba(255,255,255,0.3)" transform="rotate(-15, 42, 42)" />
      <defs>
        <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff8ec4" />
          <stop offset="50%" stopColor="#ff6b9d" />
          <stop offset="100%" stopColor="#e84d8a" />
        </linearGradient>
      </defs>
    </svg>
  );
}
