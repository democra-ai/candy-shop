/**
 * The 8 category candies — ONE cohesive set.
 *
 * Every candy: viewBox 0 0 48 48, rounded geometry, a single flat `color` fill,
 * one soft WHITE inner highlight, and (where it adds form) one soft BLACK shade.
 * No second hue — depth is neutral overlay only, so each icon is automatically
 * same-hue for whatever flavor `color` is passed. Uniform weight + rounding +
 * highlight treatment across all eight is what makes the set read as a system.
 *
 * Category → candy (DESIGN.md §2 / §6):
 *   Development=ChocolateBar(Raspberry) · Design=SwirlLollipop(Grape)
 *   Marketing=CaramelCube(Caramel)      · Productivity=MintDrop(Mint)
 *   Tools=ChocolateSquare(Chocolate)    · Research=Gumball(Blueberry)
 *   Mobile=WrappedCandy(Lemon)          · Writing=GumdropTwist(Bubblegum)
 */
import type { IllustrationProps } from './types';
import { DEFAULT_COLOR, HI, SH } from './types';

type Props = IllustrationProps;

/** Shared <svg> shell — locks size/viewBox/color defaults for the whole set. */
function Svg({
  size = 48,
  color = DEFAULT_COLOR,
  className,
  children,
  ...rest
}: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      className={className}
      style={{ color, ...(rest.style || {}) }}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* 1 ─ Development · Raspberry · rounded chocolate bar with score lines */
export function ChocolateBar(props: Props) {
  return (
    <Svg {...props}>
      <rect x="9" y="12" width="30" height="24" rx="6" fill="currentColor" />
      {/* 2×3 score grid — same-hue shade lines */}
      <g stroke={SH} strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round">
        <line x1="24" y1="15" x2="24" y2="33" />
        <line x1="13" y1="24" x2="35" y2="24" />
      </g>
      <g fill={SH} fillOpacity="0.1">
        <rect x="9" y="30" width="30" height="6" rx="3" />
      </g>
      {/* top-left gloss */}
      <rect x="13" y="15.5" width="9" height="5" rx="2.5" fill={HI} fillOpacity="0.5" />
    </Svg>
  );
}

/* 2 ─ Design · Grape · swirl lollipop on a stick */
export function SwirlLollipop(props: Props) {
  return (
    <Svg {...props}>
      {/* stick */}
      <rect x="22.5" y="24" width="3" height="18" rx="1.5" fill={SH} fillOpacity="0.18" />
      <rect x="22.5" y="24" width="3" height="18" rx="1.5" fill="currentColor" fillOpacity="0.25" />
      {/* disc */}
      <circle cx="24" cy="17" r="12" fill="currentColor" />
      {/* volume shade on lower disc */}
      <path d="M24 29 a12 12 0 0 0 10.4 -6 a12 12 0 0 1 -20.8 0 A12 12 0 0 0 24 29 Z" fill={SH} fillOpacity="0.1" />
      {/* clean even spiral — starts fully inside the disc (r=8.5 < 12) so no lip
          pokes past the edge; two smooth coils into the centre */}
      <path
        d="M24 17
           m0 -8.5
           a8.5 8.5 0 1 1 -6 2.5
           a5.6 5.6 0 1 1 4 -1.7
           a3 3 0 1 1 -2 0.9"
        fill="none"
        stroke={HI}
        strokeOpacity="0.7"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="17" r="1.4" fill={HI} fillOpacity="0.7" />
      {/* gloss — kept inside the disc edge */}
      <ellipse cx="19.5" cy="12.5" rx="2.6" ry="1.8" fill={HI} fillOpacity="0.45" transform="rotate(-30 19.5 12.5)" />
    </Svg>
  );
}

/* 3 ─ Marketing · Caramel · soft cube */
export function CaramelCube(props: Props) {
  return (
    <Svg {...props}>
      {/* top face */}
      <path d="M24 6 L40 14 L24 22 L8 14 Z" fill="currentColor" />
      <path d="M24 6 L40 14 L24 22 L8 14 Z" fill={HI} fillOpacity="0.22" />
      {/* left face */}
      <path d="M8 14 L24 22 L24 40 L8 32 Z" fill="currentColor" />
      <path d="M8 14 L24 22 L24 40 L8 32 Z" fill={SH} fillOpacity="0.06" />
      {/* right face (darker) */}
      <path d="M40 14 L24 22 L24 40 L40 32 Z" fill="currentColor" />
      <path d="M40 14 L24 22 L24 40 L40 32 Z" fill={SH} fillOpacity="0.18" />
      {/* top gloss */}
      <ellipse cx="20" cy="13" rx="4" ry="1.8" fill={HI} fillOpacity="0.5" transform="rotate(-18 20 13)" />
    </Svg>
  );
}

/* 4 ─ Productivity · Mint · rounded drop / pastille */
export function MintDrop(props: Props) {
  return (
    <Svg {...props}>
      {/* teardrop: round bottom, gently pointed top */}
      <path
        d="M24 7 C30 15 35 20 35 28 a11 11 0 0 1 -22 0 C13 20 18 15 24 7 Z"
        fill="currentColor"
      />
      {/* base shade for roundness */}
      <ellipse cx="24" cy="31" rx="9.5" ry="6" fill={SH} fillOpacity="0.12" />
      {/* highlight */}
      <ellipse cx="20" cy="20" rx="3.2" ry="5" fill={HI} fillOpacity="0.55" transform="rotate(-18 20 20)" />
    </Svg>
  );
}

/* 5 ─ Tools · Chocolate · single rounded square / praline with drizzle */
export function ChocolateSquare(props: Props) {
  return (
    <Svg {...props}>
      <rect x="10" y="10" width="28" height="28" rx="8" fill="currentColor" />
      {/* base shade for a beveled praline edge */}
      <rect x="10" y="30" width="28" height="8" rx="4" fill={SH} fillOpacity="0.12" />
      {/* clean parallel drizzle lines (a praline signature) — same-hue highlight */}
      <g stroke={HI} strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round">
        <line x1="16" y1="30" x2="26" y2="16" />
        <line x1="22" y1="32" x2="32" y2="18" />
      </g>
      {/* corner gloss */}
      <rect x="14" y="13.5" width="8" height="4.5" rx="2.25" fill={HI} fillOpacity="0.5" />
    </Svg>
  );
}

/* 6 ─ Research · Blueberry · gumball sphere */
export function Gumball(props: Props) {
  return (
    <Svg {...props}>
      <circle cx="24" cy="24" r="15" fill="currentColor" />
      {/* bottom shade for volume */}
      <path d="M24 39 a15 15 0 0 0 13 -7.5 a15 15 0 0 1 -26 0 A15 15 0 0 0 24 39 Z" fill={SH} fillOpacity="0.14" />
      {/* specular highlight + tiny sparkle */}
      <ellipse cx="18.5" cy="18.5" rx="4.5" ry="3.2" fill={HI} fillOpacity="0.6" transform="rotate(-30 18.5 18.5)" />
      <circle cx="29" cy="17" r="1.6" fill={HI} fillOpacity="0.5" />
    </Svg>
  );
}

/* 7 ─ Mobile · Lemon · wrapped candy with twisted ends */
export function WrappedCandy(props: Props) {
  return (
    <Svg {...props}>
      {/* left wrapper */}
      <path d="M9 24 L16 18 L16 30 Z" fill="currentColor" />
      <path d="M9 24 L16 18 L16 30 Z" fill={SH} fillOpacity="0.16" />
      {/* right wrapper */}
      <path d="M39 24 L32 18 L32 30 Z" fill="currentColor" />
      <path d="M39 24 L32 18 L32 30 Z" fill={SH} fillOpacity="0.16" />
      {/* body */}
      <rect x="15" y="15" width="18" height="18" rx="9" fill="currentColor" />
      {/* gloss */}
      <ellipse cx="21" cy="21" rx="3.4" ry="2.4" fill={HI} fillOpacity="0.55" transform="rotate(-25 21 21)" />
      <ellipse cx="24" cy="29" rx="7" ry="2.4" fill={SH} fillOpacity="0.12" />
    </Svg>
  );
}

/* 8 ─ Writing · Bubblegum · gumdrop with a soft rounded top + sugar band */
export function GumdropTwist(props: Props) {
  return (
    <Svg {...props}>
      {/* gumdrop body — soft rounded dome on a wide base, no spike */}
      <path
        d="M24 11
           C30 11 34 16 35 23
           C35.6 27 35 31 33 33
           a2.5 2.5 0 0 1 -1.8 0.8 H16.8
           A2.5 2.5 0 0 1 15 33
           C13 31 12.4 27 13 23
           C14 16 18 11 24 11 Z"
        fill="currentColor"
      />
      {/* sugar-crystal band near the base — same-hue highlight dots */}
      <g fill={HI} fillOpacity="0.5">
        <circle cx="18" cy="29" r="1.3" />
        <circle cx="23" cy="31" r="1.3" />
        <circle cx="29" cy="29" r="1.3" />
        <circle cx="20.5" cy="32.5" r="1.1" />
        <circle cx="26.5" cy="32.5" r="1.1" />
      </g>
      {/* base shade for roundness */}
      <path d="M14 31 c1 1.6 2 2.6 2.8 2.8 H31.2 c0.8 -0.2 1.8 -1.2 2.8 -2.8 Z" fill={SH} fillOpacity="0.1" />
      {/* highlight */}
      <ellipse cx="20" cy="20" rx="3" ry="4.6" fill={HI} fillOpacity="0.5" transform="rotate(-16 20 20)" />
    </Svg>
  );
}
