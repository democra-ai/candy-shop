/**
 * Spot illustrations for empty / zero states. Larger (viewBox 0 0 96 96), same
 * style language as the icon set. The glass/wood structure is drawn in neutral
 * ink so it works on any background; the candy accents use `color` (flavor base).
 *
 *  EmptyJar — an empty candy jar (few candies left at the bottom).
 *  Counter  — a shop counter / sign-in spot (a little awning + bell).
 */
import type { IllustrationProps } from './types';
import { DEFAULT_COLOR, HI, SH } from './types';

/** Empty candy jar — for "no skills / no results / empty library". */
export function EmptyJar({
  size = 96,
  color = DEFAULT_COLOR,
  className,
  ...rest
}: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="Empty candy jar"
      className={className}
      style={{ color, ...(rest.style || {}) }}
      {...rest}
    >
      {/* lid */}
      <rect x="30" y="14" width="36" height="9" rx="4.5" fill="currentColor" />
      <rect x="34" y="10" width="28" height="7" rx="3.5" fill="currentColor" fillOpacity="0.7" />
      <rect x="34" y="11.5" width="11" height="2.4" rx="1.2" fill={HI} fillOpacity="0.5" />

      {/* glass jar body */}
      <path
        d="M26 30 a6 6 0 0 1 6 -6 h32 a6 6 0 0 1 6 6 v44 a8 8 0 0 1 -8 8 H34 a8 8 0 0 1 -8 -8 Z"
        fill="currentColor"
        fillOpacity="0.1"
      />
      <path
        d="M26 30 a6 6 0 0 1 6 -6 h32 a6 6 0 0 1 6 6 v44 a8 8 0 0 1 -8 8 H34 a8 8 0 0 1 -8 -8 Z"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="3"
      />
      {/* glass streak */}
      <rect x="33" y="32" width="5" height="40" rx="2.5" fill={HI} fillOpacity="0.5" />

      {/* a few lonely candies at the bottom */}
      <circle cx="40" cy="74" r="6" fill="currentColor" />
      <ellipse cx="38" cy="72" rx="1.8" ry="1.2" fill={HI} fillOpacity="0.6" transform="rotate(-30 38 72)" />
      <circle cx="54" cy="76" r="5" fill="currentColor" fillOpacity="0.85" />
      <ellipse cx="52.5" cy="74.5" rx="1.4" ry="1" fill={HI} fillOpacity="0.6" transform="rotate(-30 52.5 74.5)" />
      <rect x="44" y="70" width="9" height="9" rx="3" fill="currentColor" fillOpacity="0.7" />
    </svg>
  );
}

/** Shop counter with awning + service bell — for sign-in / auth empty states. */
export function Counter({
  size = 96,
  color = DEFAULT_COLOR,
  className,
  ...rest
}: IllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="Shop counter"
      className={className}
      style={{ color, ...(rest.style || {}) }}
      {...rest}
    >
      {/* awning */}
      <path d="M14 30 h68 v8 a0 0 0 0 1 0 0 H14 Z" fill="currentColor" />
      <path
        d="M14 38 h68 l-8.5 9 a4 4 0 0 1 -5.7 0 l-3.4 -3.6 a4 4 0 0 0 -5.8 0 l-3.4 3.6 a4 4 0 0 1 -5.8 0 l-3.4 -3.6 a4 4 0 0 0 -5.8 0 l-3.4 3.6 a4 4 0 0 1 -5.7 0 Z"
        fill="currentColor"
      />
      <path
        d="M14 38 h68 l-8.5 9 a4 4 0 0 1 -5.7 0 l-3.4 -3.6 a4 4 0 0 0 -5.8 0 l-3.4 3.6 a4 4 0 0 1 -5.8 0 l-3.4 -3.6 a4 4 0 0 0 -5.8 0 l-3.4 3.6 a4 4 0 0 1 -5.7 0 Z"
        fill={SH}
        fillOpacity="0.12"
      />
      <rect x="18" y="31" width="14" height="6" rx="2" fill={HI} fillOpacity="0.4" />

      {/* counter top */}
      <rect x="20" y="60" width="56" height="7" rx="3.5" fill="currentColor" fillOpacity="0.85" />
      {/* counter base (neutral, like wood/stone) */}
      <rect x="24" y="67" width="48" height="20" rx="4" fill="currentColor" fillOpacity="0.16" />
      <rect x="24" y="67" width="48" height="20" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2.5" />
      <line x1="48" y1="67" x2="48" y2="87" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />

      {/* service bell on the counter */}
      <path d="M40 60 a8 8 0 0 1 16 0 Z" fill="currentColor" />
      <ellipse cx="45" cy="55" rx="2.4" ry="1.6" fill={HI} fillOpacity="0.55" transform="rotate(-25 45 55)" />
      <circle cx="48" cy="49" r="2.4" fill="currentColor" />
      <rect x="38" y="59.5" width="20" height="3" rx="1.5" fill={SH} fillOpacity="0.16" />
    </svg>
  );
}
