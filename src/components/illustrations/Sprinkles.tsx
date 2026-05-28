/**
 * Sprinkles — subtle decorative confetti for background accents (hero corners,
 * section wells, empty states). Low-opacity little capsules + dots. Strokeless,
 * monochrome by default (inherits `color`), so it stays a quiet accent — never a
 * rainbow. Wide viewBox so it can stretch behind content.
 *
 *  <Sprinkles />                       → currentColor, default opacity
 *  <Sprinkles color="#9B5DE5" opacity={0.25} />
 */
import type { SVGProps } from 'react';

export interface SprinklesProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
  /** Width in px (height scales with viewBox). Default 240. */
  width?: number;
  color?: string;
  /** Overall opacity of the sprinkle layer. Default 0.18. */
  opacity?: number;
  className?: string;
}

/** A scattered set of capsule + dot sprinkles. Decorative only (aria-hidden). */
export function Sprinkles({
  width = 240,
  color = 'currentColor',
  opacity = 0.18,
  className,
  ...rest
}: SprinklesProps) {
  return (
    <svg
      width={width}
      viewBox="0 0 240 120"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ color, opacity, ...(rest.style || {}) }}
      {...rest}
    >
      <g fill="currentColor">
        {/* capsules (rotated rounded rects) */}
        <rect x="18" y="20" width="22" height="7" rx="3.5" transform="rotate(28 29 23.5)" />
        <rect x="92" y="14" width="22" height="7" rx="3.5" transform="rotate(-18 103 17.5)" />
        <rect x="168" y="30" width="22" height="7" rx="3.5" transform="rotate(46 179 33.5)" />
        <rect x="52" y="78" width="22" height="7" rx="3.5" transform="rotate(-36 63 81.5)" />
        <rect x="132" y="86" width="22" height="7" rx="3.5" transform="rotate(14 143 89.5)" />
        <rect x="206" y="70" width="22" height="7" rx="3.5" transform="rotate(-52 217 73.5)" />
        {/* dots */}
        <circle cx="64" cy="40" r="3.6" />
        <circle cx="148" cy="22" r="3.2" />
        <circle cx="20" cy="64" r="3.4" />
        <circle cx="112" cy="64" r="3" />
        <circle cx="196" cy="44" r="3.6" />
        <circle cx="96" cy="100" r="3.2" />
        <circle cx="178" cy="98" r="3.4" />
      </g>
    </svg>
  );
}
