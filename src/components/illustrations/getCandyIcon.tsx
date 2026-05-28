/**
 * getCandyIcon — maps a category (or flavor) to its candy illustration, already
 * defaulted to that flavor's base color. This is the single entry point that
 * replaces every old emoji call site (`getCandyEmoji`, raw 🍭, etc.).
 *
 *   import { getCandyIcon } from '@/components/illustrations';
 *   const Candy = getCandyIcon(skill.category);
 *   <Candy size={40} />                 // already the right flavor color
 *   <Candy size={40} color={shell.base} /> // or override
 */
import type { ComponentType } from 'react';
import type { IllustrationProps } from './types';
import { getCandyColor } from '../../utils/candyShells';
import {
  ChocolateBar,
  SwirlLollipop,
  CaramelCube,
  MintDrop,
  ChocolateSquare,
  Gumball,
  WrappedCandy,
  GumdropTwist,
} from './CategoryCandies';

type CandyComponent = ComponentType<IllustrationProps>;

/** Category → candy component (DESIGN.md §2 / §6). */
const CATEGORY_ICON: Record<string, CandyComponent> = {
  Development: ChocolateBar,
  Design: SwirlLollipop,
  Marketing: CaramelCube,
  Productivity: MintDrop,
  Tools: ChocolateSquare,
  Research: Gumball,
  Mobile: WrappedCandy,
  Writing: GumdropTwist,
};

/** Also accept flavor names directly, so call sites can pass either. */
const FLAVOR_ICON: Record<string, CandyComponent> = {
  Raspberry: ChocolateBar,
  Grape: SwirlLollipop,
  Caramel: CaramelCube,
  Mint: MintDrop,
  Chocolate: ChocolateSquare,
  Blueberry: Gumball,
  Lemon: WrappedCandy,
  Bubblegum: GumdropTwist,
};

/**
 * Return the candy component for a category/flavor, pre-bound to that flavor's
 * base color (overridable via the `color` prop) and theme-aware.
 *
 * Falls back to the brand candy (ChocolateBar / Raspberry) for unknown input.
 */
export function getCandyIcon(category: string | undefined, isDark = false): CandyComponent {
  const Base =
    (category && (CATEGORY_ICON[category] || FLAVOR_ICON[category])) || ChocolateBar;
  const fallbackColor = getCandyColor(category, isDark);

  const Bound: CandyComponent = ({ color, ...rest }) => (
    <Base color={color ?? fallbackColor} {...rest} />
  );
  Bound.displayName = `CandyIcon(${category ?? 'brand'})`;
  return Bound;
}
