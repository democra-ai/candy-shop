/**
 * Candy Shop illustration system — barrel export.
 *
 * The brand's custom SVG signature. Replaces ALL emoji-as-UI. Every component
 * shares one style language (rounded geometry, flat fill + one white gloss +
 * same-hue shade, viewBox 48 / 96) and accepts `{ size?, color?, className? }`.
 *
 *   import { Logo, Pip, EmptyJar, getCandyIcon } from '@/components/illustrations';
 *
 * See README.md in this folder for the propagation guide.
 */

// Types + style constants
export type { IllustrationProps } from './types';
export { DEFAULT_COLOR } from './types';

// Brand
export { LogoMark, Wordmark, Logo } from './LogoMark';
export type { WordmarkProps, LogoProps } from './LogoMark';

// Category candies (the cohesive 8)
export {
  ChocolateBar,
  SwirlLollipop,
  CaramelCube,
  MintDrop,
  ChocolateSquare,
  Gumball,
  WrappedCandy,
  GumdropTwist,
} from './CategoryCandies';

// Mascot
export { Pip } from './Pip';

// Empty-state spots
export { EmptyJar, Counter } from './Spots';

// Decorative
export { Sprinkles } from './Sprinkles';
export type { SprinklesProps } from './Sprinkles';

// Category → component resolver (the emoji replacement)
export { getCandyIcon } from './getCandyIcon';
