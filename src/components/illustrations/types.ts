/**
 * Shared types + helpers for the Candy Shop illustration system.
 *
 * STYLE CONTRACT (every component obeys — this uniformity is what reads as
 * "professional" rather than "小作坊"):
 *  - viewBox 0 0 48 48 (spots: 0 0 96 96), simple rounded geometry.
 *  - ONE flat fill in `color` (defaults to the flavor base, currentColor-aware)
 *    + depth from same-hue overlays only: a WHITE highlight ellipse/arc at low
 *    opacity, and (where needed) a BLACK shade at low opacity. No second hue.
 *    Using neutral overlays instead of literal lighter/darker hex keeps every
 *    icon automatically same-hue for whatever `color` is passed → cohesive set.
 *  - Consistent visual weight, corner rounding, and highlight treatment.
 */
import type { SVGProps } from 'react';

export interface IllustrationProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
  /** Pixel size for width & height (square). Default 48 (spots default 96). */
  size?: number;
  /** Fill color. Defaults to the flavor base (or currentColor). */
  color?: string;
  className?: string;
}

/** Default brand accent (Raspberry base) when no color is supplied. */
export const DEFAULT_COLOR = '#F0407A';

/** Same-hue highlight (soft white) and shade (soft black) — never a new hue. */
export const HI = '#FFFFFF';
export const SH = '#000000';
