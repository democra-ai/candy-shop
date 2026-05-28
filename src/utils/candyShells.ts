/**
 * candyShells — the single source of truth for the muted boutique CARD palette
 * (per category), light + dark, matching DESIGN.md §3.
 *
 * Every category-colored surface (CandyCard, MostPopularRail, Categories tiles,
 * ShopWindow bento cells) reads from here so light and dark stay consistent and
 * there is one place to tune. Dark cards = deep tone bg + light ink (NOT light
 * pastels floating on the dark aubergine background).
 *
 * Usage:
 *   const isDark = useIsDark();
 *   const shell = getShell(skill.category, isDark);
 *   // shell.bg / shell.text / shell.accent / shell.chipBg
 */

export interface Shell {
  /** Card background — solid pastel (light) / deep tone (dark) */
  bg: string;
  /** Primary ink — dark same-hue (light) / light same-hue (dark) */
  text: string;
  /** Stronger ink for badges, pills, run button bg */
  accent: string;
  /** Low-opacity chip background derived from the ink */
  chipBg: string;
  /** Tailwind focus ring class (theme-neutral, fine for both modes) */
  ring: string;
}

interface ShellPair {
  light: Shell;
  dark: Shell;
}

// Light values per DESIGN.md §3; dark values are deep-tone bg + light ink.
const SHELL_PAIRS: Record<string, ShellPair> = {
  Development: {
    light: { bg: '#EDD5D5', text: '#7A3838', accent: '#5E2828', chipBg: 'rgba(122, 56, 56, 0.10)', ring: 'focus:ring-rose-200' },
    dark:  { bg: '#3A2630', text: '#F0C9CE', accent: '#F0C9CE', chipBg: 'rgba(240, 201, 206, 0.14)', ring: 'focus:ring-rose-300/40' },
  },
  Design: {
    light: { bg: '#E3DAE8', text: '#4D3E5C', accent: '#3A2E48', chipBg: 'rgba(77, 62, 92, 0.10)', ring: 'focus:ring-violet-200' },
    dark:  { bg: '#2E2640', text: '#D9C9EC', accent: '#D9C9EC', chipBg: 'rgba(217, 201, 236, 0.14)', ring: 'focus:ring-violet-300/40' },
  },
  Marketing: {
    light: { bg: '#EDDDC4', text: '#6E4F26', accent: '#553A1A', chipBg: 'rgba(110, 79, 38, 0.10)', ring: 'focus:ring-amber-200' },
    dark:  { bg: '#3A2F1E', text: '#EAD2A8', accent: '#EAD2A8', chipBg: 'rgba(234, 210, 168, 0.14)', ring: 'focus:ring-amber-300/40' },
  },
  Productivity: {
    light: { bg: '#D5E5D8', text: '#3D5E45', accent: '#2C4632', chipBg: 'rgba(61, 94, 69, 0.10)', ring: 'focus:ring-emerald-200' },
    dark:  { bg: '#22332A', text: '#BFE0C8', accent: '#BFE0C8', chipBg: 'rgba(191, 224, 200, 0.14)', ring: 'focus:ring-emerald-300/40' },
  },
  Tools: {
    light: { bg: '#E5DBD0', text: '#5B4938', accent: '#43352A', chipBg: 'rgba(91, 73, 56, 0.10)', ring: 'focus:ring-stone-200' },
    dark:  { bg: '#332A22', text: '#E0CDB8', accent: '#E0CDB8', chipBg: 'rgba(224, 205, 184, 0.14)', ring: 'focus:ring-stone-300/40' },
  },
  Research: {
    light: { bg: '#D5DFE8', text: '#3D4E62', accent: '#2C3A4A', chipBg: 'rgba(61, 78, 98, 0.10)', ring: 'focus:ring-sky-200' },
    dark:  { bg: '#22303E', text: '#BFD3E5', accent: '#BFD3E5', chipBg: 'rgba(191, 211, 229, 0.14)', ring: 'focus:ring-sky-300/40' },
  },
  Mobile: {
    light: { bg: '#E8E2C9', text: '#5E5430', accent: '#453D22', chipBg: 'rgba(94, 84, 48, 0.10)', ring: 'focus:ring-lime-200' },
    dark:  { bg: '#332E1E', text: '#E2D7A8', accent: '#E2D7A8', chipBg: 'rgba(226, 215, 168, 0.14)', ring: 'focus:ring-lime-300/40' },
  },
  Writing: {
    light: { bg: '#EAD5D5', text: '#6E3D3D', accent: '#532C2C', chipBg: 'rgba(110, 61, 61, 0.10)', ring: 'focus:ring-pink-200' },
    dark:  { bg: '#382628', text: '#EEC9CC', accent: '#EEC9CC', chipBg: 'rgba(238, 201, 204, 0.14)', ring: 'focus:ring-pink-300/40' },
  },
};

const FALLBACK_PAIR: ShellPair = {
  light: { bg: '#E5DFD8', text: '#4A4039', accent: '#352D27', chipBg: 'rgba(74, 64, 57, 0.10)', ring: 'focus:ring-stone-200' },
  dark:  { bg: '#2C2622', text: '#DDD0C5', accent: '#DDD0C5', chipBg: 'rgba(221, 208, 197, 0.14)', ring: 'focus:ring-stone-300/40' },
};

/** Resolve a category + theme to its boutique shell. */
export function getShell(category: string | undefined, isDark: boolean): Shell {
  const pair = (category && SHELL_PAIRS[category]) || FALLBACK_PAIR;
  return isDark ? pair.dark : pair.light;
}

export { FALLBACK_PAIR };

/* ────────────────────────────────────────────────────────────────────────────
 * CALIBRATED FLAVOR PALETTE (DESIGN.md §2) — playful-premium v2
 *
 * The boutique `Shell` above floods whole cards with a muted tone. The v2
 * direction is different: color is carried by the ILLUSTRATION + ACCENTS on a
 * clean neutral canvas. This section exposes the calibrated brand palette —
 * `{ base, tint, ink }` per flavor, light + dark — for that calibrated usage:
 *
 *   base — the vivid accent: illustration fills, icon badges, buttons, focus
 *          rings, hover borders. The SVG illustration system defaults to this.
 *   tint — a soft (~12% light / ~16%-over-dark-card) background for chips and
 *          section "wells".
 *   ink  — readable text ON the tint. Dark hue on light tint; light hue in dark.
 *
 * `getShell` is untouched (existing callers keep `{bg,text,accent,chipBg,ring}`).
 * New surfaces / the illustration system read `getFlavor` / `getCandyColor`.
 * ──────────────────────────────────────────────────────────────────────────── */

/** A flavor's calibrated color tokens for one theme. */
export interface FlavorTokens {
  /** Vivid accent — illustration fill, badge, button, ring, hover border. */
  base: string;
  /** Soft background — ~12% (light) / base ~16% over the dark card (dark). */
  tint: string;
  /** Readable text on `tint`. Dark hue (light) / light hue (dark). */
  ink: string;
  /** Tailwind focus-ring class for this flavor (theme-neutral). */
  ring: string;
}

/** Raw color tokens without the derived `ring` (added by getFlavor). */
type FlavorColors = Omit<FlavorTokens, 'ring'>;

interface FlavorPair {
  light: FlavorColors;
  dark: FlavorColors;
}

/** Canonical flavor names. */
export type Flavor =
  | 'Raspberry'
  | 'Grape'
  | 'Mint'
  | 'Caramel'
  | 'Blueberry'
  | 'Lemon'
  | 'Bubblegum'
  | 'Chocolate';

/**
 * Calibrated palette. Light = DESIGN.md §2 table verbatim. Dark = same (or
 * marginally brighter) base, tint as the base at ~16% over the dark card
 * (#1E1126), ink as a light version of the hue that stays legible on that tint.
 */
const FLAVOR_PAIRS: Record<Flavor, FlavorPair> = {
  Raspberry: {
    light: { base: '#F0407A', tint: '#FDE6EE', ink: '#8A1E45' },
    dark:  { base: '#FF5C90', tint: '#3A2030', ink: '#FFC2D6' },
  },
  Grape: {
    light: { base: '#9B5DE5', tint: '#F0E8FB', ink: '#4F2E80' },
    dark:  { base: '#B17AF0', tint: '#2C2440', ink: '#DDC6F7' },
  },
  Mint: {
    light: { base: '#11B894', tint: '#DEF5EF', ink: '#0A5E4B' },
    dark:  { base: '#2BD3AC', tint: '#15302A', ink: '#9DE9D6' },
  },
  Caramel: {
    light: { base: '#FF9F1C', tint: '#FFF0DA', ink: '#8A5410' },
    dark:  { base: '#FFB347', tint: '#3A2C18', ink: '#FFD9A0' },
  },
  Blueberry: {
    light: { base: '#4D8DFF', tint: '#E4EDFF', ink: '#23508F' },
    dark:  { base: '#6FA4FF', tint: '#1E2A40', ink: '#BBD3FF' },
  },
  Lemon: {
    light: { base: '#F5C518', tint: '#FDF4D4', ink: '#856A09' },
    dark:  { base: '#FAD64A', tint: '#352F18', ink: '#F6E59B' },
  },
  Bubblegum: {
    light: { base: '#FF7AC6', tint: '#FFE7F5', ink: '#8E3A69' },
    dark:  { base: '#FF94D2', tint: '#3A2433', ink: '#FFC8E8' },
  },
  Chocolate: {
    light: { base: '#9C6B43', tint: '#F1E7DD', ink: '#5A3C22' },
    dark:  { base: '#C28A5C', tint: '#2E2520', ink: '#E4C6AC' },
  },
};

/** Category → flavor name (kept in sync with DESIGN.md §2 and getShell keys). */
export const CATEGORY_FLAVOR: Record<string, Flavor> = {
  Development: 'Raspberry',
  Design: 'Grape',
  Marketing: 'Caramel',
  Productivity: 'Mint',
  Tools: 'Chocolate',
  Research: 'Blueberry',
  Mobile: 'Lemon',
  Writing: 'Bubblegum',
};

/** Brand flavor — Raspberry. Use for the logo mark + primary CTA accents. */
export const BRAND_FLAVOR: Flavor = 'Raspberry';

/** Per-flavor focus-ring class (theme-neutral; works in light + dark). */
const FLAVOR_RING: Record<Flavor, string> = {
  Raspberry: 'focus:ring-pink-300/50',
  Grape: 'focus:ring-violet-300/50',
  Mint: 'focus:ring-emerald-300/50',
  Caramel: 'focus:ring-amber-300/50',
  Blueberry: 'focus:ring-blue-300/50',
  Lemon: 'focus:ring-yellow-300/50',
  Bubblegum: 'focus:ring-pink-300/50',
  Chocolate: 'focus:ring-amber-300/40',
};

const FALLBACK_FLAVOR_PAIR: FlavorPair = FLAVOR_PAIRS[BRAND_FLAVOR];

/** Resolve a category (or flavor name) to its flavor name; brand as fallback. */
export function flavorForCategory(category: string | undefined): Flavor {
  if (!category) return BRAND_FLAVOR;
  if (category in FLAVOR_PAIRS) return category as Flavor;
  return CATEGORY_FLAVOR[category] ?? BRAND_FLAVOR;
}

/**
 * Resolve a category (or flavor name) + theme to its calibrated `{base,tint,ink}`.
 * Accepts either a category ("Development") or a flavor ("Raspberry").
 */
export function getFlavor(category: string | undefined, isDark: boolean): FlavorTokens {
  const flavor = flavorForCategory(category);
  const pair = FLAVOR_PAIRS[flavor] ?? FALLBACK_FLAVOR_PAIR;
  const tokens = isDark ? pair.dark : pair.light;
  return { ...tokens, ring: FLAVOR_RING[flavor] ?? FLAVOR_RING[BRAND_FLAVOR] };
}

/**
 * Just the vivid base color for a category/flavor — the default color fed to
 * the SVG illustration components. Theme-independent unless `isDark` is passed.
 */
export function getCandyColor(category: string | undefined, isDark = false): string {
  return getFlavor(category, isDark).base;
}

export { FLAVOR_PAIRS };
