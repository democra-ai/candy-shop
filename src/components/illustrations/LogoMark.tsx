/**
 * Brand mark — a refined wrapped lollipop. Same style language as the category
 * candies (rounded geometry, flat fill, one white gloss + same-hue shade) so the
 * logo and the icon set read as one family. Defaults to Raspberry (brand base).
 *
 *  <LogoMark />            → just the candy mark
 *  <Wordmark />           → "Candy Shop" in Fredoka
 *  <Logo />               → mark + wordmark lockup (header / footer)
 */
import type { IllustrationProps } from './types';
import { DEFAULT_COLOR, HI, SH } from './types';

/** The candy disc mark on its stick. */
export function LogoMark({
  size = 48,
  color = DEFAULT_COLOR,
  className,
  ...rest
}: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Candy Shop"
      className={className}
      style={{ color, ...(rest.style || {}) }}
      {...rest}
    >
      {/* stick */}
      <rect x="22.4" y="22" width="3.2" height="20" rx="1.6" fill="currentColor" fillOpacity="0.28" />
      <rect x="22.4" y="22" width="3.2" height="20" rx="1.6" fill={SH} fillOpacity="0.12" />
      {/* disc */}
      <circle cx="24" cy="16" r="13" fill="currentColor" />
      {/* clean single-hue spiral (the brand signature) */}
      <path
        d="M24 16 m0 -9 a9 9 0 1 1 -8.3 5.6 a5.4 5.4 0 1 0 5.4 -3.4 a2.2 2.2 0 1 1 -1.9 1.9"
        fill="none"
        stroke={HI}
        strokeOpacity="0.85"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* volume shade on lower disc */}
      <path d="M24 29 a13 13 0 0 0 11.3 -6.6 a13 13 0 0 1 -22.6 0 A13 13 0 0 0 24 29 Z" fill={SH} fillOpacity="0.1" />
      {/* gloss */}
      <ellipse cx="18.5" cy="10.5" rx="3.6" ry="2.4" fill={HI} fillOpacity="0.6" transform="rotate(-30 18.5 10.5)" />
    </svg>
  );
}

export interface WordmarkProps {
  className?: string;
  /** Color of "Candy" (defaults to brand base); "Shop" uses currentColor/ink. */
  color?: string;
}

/** "Candy Shop" set in Fredoka. "Candy" in the brand color, "Shop" in ink. */
export function Wordmark({ className, color = DEFAULT_COLOR }: WordmarkProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: '"Fredoka","Quicksand",sans-serif',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color }}>Candy</span>
      <span style={{ color: 'currentColor' }}> Shop</span>
    </span>
  );
}

export interface LogoProps {
  /** Mark size in px (wordmark scales relative to it). Default 32. */
  size?: number;
  color?: string;
  className?: string;
  /** Hide the wordmark (mark only). */
  markOnly?: boolean;
}

/** Mark + wordmark lockup. Inherits text color for "Shop" + surrounding ink. */
export function Logo({ size = 32, color = DEFAULT_COLOR, className, markOnly = false }: LogoProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28 }}
    >
      <LogoMark size={size} color={color} />
      {!markOnly && (
        <Wordmark color={color} className="" />
      )}
    </span>
  );
}
