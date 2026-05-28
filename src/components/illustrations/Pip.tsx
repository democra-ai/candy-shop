/**
 * Pip — the lollipop mascot. ONE charming character: a candy-disc head with a
 * friendly face, a little stick body, and a raised waving arm. Same style as the
 * rest of the set (rounded, flat fill in `color`, white gloss + same-hue shade);
 * the face features are neutral ink so they stay legible on any flavor.
 *
 * Used once (ShopWindow / empty hero). Larger by default. Pass `color` to recolor.
 */
import type { IllustrationProps } from './types';
import { DEFAULT_COLOR, HI, SH } from './types';

export function Pip({
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
      aria-label="Pip the lollipop mascot"
      className={className}
      style={{ color, ...(rest.style || {}) }}
      {...rest}
    >
      {/* stick / body */}
      <rect x="44" y="58" width="8" height="30" rx="4" fill="currentColor" fillOpacity="0.32" />
      <rect x="44" y="58" width="8" height="30" rx="4" fill={SH} fillOpacity="0.1" />

      {/* waving arm — one continuous rounded limb from the body up to a hand,
          so it clearly reads as an arm, not a floating blob */}
      <path
        d="M50 63 C59 62 66 57 70 49"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* mitten hand at the arm tip */}
      <circle cx="71" cy="46" r="5.5" fill="currentColor" fillOpacity="0.5" />
      <ellipse cx="69.5" cy="44.5" rx="1.6" ry="1.1" fill={HI} fillOpacity="0.5" transform="rotate(-30 69.5 44.5)" />

      {/* head disc */}
      <circle cx="44" cy="36" r="26" fill="currentColor" />
      {/* same-hue spiral wrap, faint, behind the face */}
      <path
        d="M44 36 m0 -17 a17 17 0 1 1 -15.6 10.4 a10 10 0 1 0 10 -6.2"
        fill="none"
        stroke={HI}
        strokeOpacity="0.28"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* volume shade */}
      <path d="M44 62 a26 26 0 0 0 22.5 -13 a26 26 0 0 1 -45 0 A26 26 0 0 0 44 62 Z" fill={SH} fillOpacity="0.1" />
      {/* gloss */}
      <ellipse cx="33" cy="26" rx="6" ry="4" fill={HI} fillOpacity="0.55" transform="rotate(-30 33 26)" />

      {/* face — neutral ink so it reads on every flavor */}
      <g fill={SH} fillOpacity="0.82">
        <circle cx="37" cy="35" r="3" />
        <circle cx="51" cy="35" r="3" />
      </g>
      {/* eye sparkles */}
      <g fill={HI} fillOpacity="0.9">
        <circle cx="38.1" cy="33.9" r="0.9" />
        <circle cx="52.1" cy="33.9" r="0.9" />
      </g>
      {/* smile */}
      <path
        d="M38 43 q6 6 12 0"
        fill="none"
        stroke={SH}
        strokeOpacity="0.82"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* cheeks */}
      <g fill={HI} fillOpacity="0.3">
        <circle cx="31.5" cy="42" r="3.2" />
        <circle cx="56.5" cy="42" r="3.2" />
      </g>
    </svg>
  );
}
