# Candy Shop — Design System v2 (source of truth)

> A two-sided marketplace for AI skills. **Playful-premium** craft — the bar is
> **Figma / Duolingo / Notion**: friendly and colorful, but executed with a real
> design system, custom illustration, soft elevation, and elastic motion. Not a
> small-workshop ("小作坊") look. Every surface must feel like one polished product.

This file is the contract. Every component obeys it. When unsure, match the
reference quality of Duolingo's lesson cards / Figma Community cards.

---

## 0. HARD RULES (do not violate — learned over many rounds)

1. **NO emoji as UI.** Every icon, brand mark, category symbol, mascot, and card
   glyph is a **custom SVG illustration component** from
   `src/components/illustrations/`. Emoji (🍭🍰🍫🧁🍬) are BANNED from rendered UI —
   they are the #1 amateur tell. (Emoji in code comments / data labels are fine if
   never rendered as the visual.)
2. **NO rainbow / multi-stop gradients.** No `pink→purple→mint` text, no
   `repeating-linear-gradient` candy-tape, no 3-stop `from-X via-Y to-Z`. Only a
   subtle **same-hue 2-stop** is allowed, sparingly.
3. **Color is carried by ILLUSTRATION + ACCENTS on a clean canvas** — NOT by
   flooding whole cards with saturated fills (that read as garish "太艳"). Cards are
   light/neutral surfaces with a vivid colored illustration + colored accents.
4. **Cards are dense & readable.** Title (line-clamp-2, ellipsis), description
   (line-clamp-2), tags, meta. Never an empty colored rectangle. Never a broken
   truncated word.
5. **Real elevation system** (§5). Soft, layered shadows — never a single harsh box
   shadow, never flat-with-no-depth.
6. **No flicker.** Theme resolved synchronously in `index.html` before first paint.
7. **Masonry + infinite scroll** for the skill grid. No pagination buttons.
8. **Verify visually** with Playwright (light+dark, desktop+mobile) and actually
   look before claiming done. The bar is "would this win a Figma community feature",
   not "does it compile".

---

## 1. Brand personality
Warm, witty, confident. A candy boutique with a modern product soul. ONE mascot:
**Pip**, a lollipop character, rendered as a real SVG illustration (never emoji).
Copy: "run candy", "the candy jar" — playful but never childish.

---

## 2. Color — vivid but CALIBRATED (Duolingo/Figma harmony)

All brand colors share consistent saturation/lightness so they harmonize. They are
used as **accents** (illustration fills, icon badges, chips, buttons, focus rings,
hover borders), on a clean neutral canvas. Each has a **tint** (≈12% — for soft
badge/section backgrounds) and an **ink** (dark, for text on tint).

| Flavor | Base (accent) | Tint (bg ~12%) | Ink (text on tint) |
|---|---|---|---|
| Raspberry (brand) | `#F0407A` | `#FDE6EE` | `#8A1E45` |
| Grape | `#9B5DE5` | `#F0E8FB` | `#4F2E80` |
| Mint | `#11B894` | `#DEF5EF` | `#0A5E4B` |
| Caramel | `#FF9F1C` | `#FFF0DA` | `#8A5410` |
| Blueberry | `#4D8DFF` | `#E4EDFF` | `#23508F` |
| Lemon | `#F5C518` | `#FDF4D4` | `#856A09` |
| Bubblegum | `#FF7AC6` | `#FFE7F5` | `#8E3A69` |
| Chocolate | `#9C6B43` | `#F1E7DD` | `#5A3C22` |

Category → flavor map: Development=Raspberry, Design=Grape, Marketing=Caramel,
Productivity=Mint, Tools=Chocolate, Research=Blueberry, Mobile=Lemon,
Writing=Bubblegum. (Extend `src/utils/candyShells.ts` to expose `{base, tint, ink}`
per flavor, light + dark.)

**Neutral canvas (tokens in `index.css` — keep using these):**
- Light: bg `#FFFDFB`, card `#FFFFFF`, ink `#1F1320`, secondary text `#6B5566`,
  border `#F1E3EC`.
- Dark: bg `#140A18`, card `#1E1126`, ink `#F7ECF4`, border `#3A2640`.
- In **dark mode**, flavor `tint` = the base at ~16% over the dark card; `ink` flips
  to a light version of the hue. Provide dark values in `candyShells.ts`.

**Card color usage (the calibrated way):**
- Card background = `bg-card` (white / dark plum). NOT a saturated fill.
- The candy **illustration** carries the vivid flavor color.
- Category chip = flavor `tint` bg + flavor `ink` text.
- Hover = border shifts to flavor base + elevation rises.
- A thin flavor-colored top accent (2-3px) or a tinted illustration "well" is OK.

### Banned
emoji-as-UI · rainbow/3-stop gradients · saturated full-card fills · white text on
neon · flat no-shadow cards.

---

## 3. Typography (strict scale)

| Role | Font | Notes |
|---|---|---|
| Display / headings / card titles | **Fredoka** (`font-candy`) | rounded, friendly; weights 500/600/700 |
| Body / UI | **Inter** (`font-body`) | 400/500/600 |
| Data / code / tags | **Fira Code** (`font-mono`) | counts, #tags, install commands, eyebrows |

**Modular scale (use these, don't freestyle):** 12 · 14 · 16 · 18 · 20 · 24 · 30 ·
38 · 48 (· clamp for hero). Line-height: display `1.05–1.15`, body `1.5`.
Tracking: display `-0.01em`, eyebrows `+0.16em` uppercase.
Rules: Fredoka never for long body; mono never for headings; max 2 weights per block.

---

## 4. Spacing, radius, geometry

- 4px grid. Component padding from {12,16,20,24}. Section rhythm `py-14 md:py-20`.
- **Radius scale:** chips/inputs `rounded-xl` (12), buttons `rounded-2xl` (16) or
  `rounded-full` (pills), cards `rounded-2xl` (16) / feature `rounded-3xl` (24).
  Be CONSISTENT — pick per component type and never mix randomly.
- Container `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
- Section header: optional small mono eyebrow (understated, NO "$ ls" prompts, NO
  "aisle 03" chips) + `font-candy text-2xl/3xl` title + optional one-line sub.
- Skill grid: `react-masonry-css`, `{default:5,1280:5,1024:4,768:3,640:2,0:2}`, 16px
  gutter, cards size to content.

---

## 5. Elevation & motion (the craft layer)

### Elevation (soft, layered — add as Tailwind `boxShadow` tokens)
- `shadow-candy-1` (resting card): `0 1px 2px rgba(31,19,32,.04), 0 4px 12px rgba(31,19,32,.05)`
- `shadow-candy-2` (hover/dropdown): `0 2px 6px rgba(31,19,32,.06), 0 12px 28px rgba(31,19,32,.10)`
- `shadow-candy-3` (modal/feature): `0 8px 20px rgba(31,19,32,.10), 0 28px 56px rgba(31,19,32,.16)`
- Dark mode: same offsets, `rgba(0,0,0,.4–.6)`.

### Buttons
- **Primary "candy button"** (Duolingo-style pressable): `bg-primary
  text-primary-foreground rounded-2xl font-semibold`, with a solid offset bottom
  shadow `box-shadow: 0 4px 0 <primary-active>`; on `:active` → `translate-y-[2px]`
  + shadow `0 2px 0`. Feels physically pressable. Use for the main CTA.
- **Secondary:** `bg-card border border-border rounded-2xl`, hover `border-border-hover` + `shadow-candy-1`.
- **Ghost:** text + hover `bg-secondary`.
- No gradient-filled buttons.

### Motion
- Easing: standard `ease-out 200ms`; **elastic** `cubic-bezier(.34,1.56,.64,1)` for
  hover lifts, card mount, badge pops.
- Card hover: `translate-y-[-4px]` + `shadow-candy-1 → shadow-candy-2`, elastic.
- Illustrations may have ONE subtle idle (gentle bob ≤1 element per view) — not many.
- Respect `prefers-reduced-motion` (already wired). No flicker, no spammed floats.

---

## 6. Custom illustration system (`src/components/illustrations/`)

A cohesive original SVG set — the brand's visual signature. Consistent style:
**rounded geometry, flat fills + ONE soft inner highlight, 2-3 colors from §2 per
icon, ~2px optical stroke or strokeless, 24/48/96 size variants.** Components accept
`className`/`size` and inherit/accept a flavor color.

Required pieces:
- **Logo mark** — a refined lollipop/candy mark + "Candy Shop" wordmark lockup.
- **8 category candies** — Raspberry-chocolate-bar (Dev), Grape-swirl-lollipop
  (Design), Caramel-cube (Marketing), Mint-drop (Productivity), Chocolate-square
  (Tools), Blueberry-gumball (Research), Lemon-wrapped-candy (Mobile),
  Bubblegum-twist (Writing). Each in its flavor color, one consistent style.
- **Pip the mascot** — lollipop character (face/wave), used once in ShopWindow.
- **Spot illustrations** for empty states (empty jar, sign-in counter).
- **Decorative confetti/sprinkle shapes** (subtle, optional, low-opacity).

A `getCandyIcon(category)` helper maps category → component. ALL prior emoji call
sites (`getCandyEmoji`, raw 🍭 etc.) are replaced by these.

---

## 7. Per-surface (apply v2 everywhere)
Home (Hero, ShopWindow, MostPopularRail, Categories, CandyCard, SkillsGrid),
detail pages, creator flow, dashboard, library, settings, all modals, chrome
(sidebar/header/footer). Every surface: clean canvas + illustration-carried color +
elevation + elastic motion + strict type. No emoji anywhere.

---

## 8. Definition of done
- Zero emoji rendered. Custom SVG illustrations everywhere.
- Vivid-but-calibrated color as accents on a clean canvas; cards readable.
- Real elevation + elastic motion; pressable primary button.
- Light AND dark correct; mobile (390) + desktop (1440) clean.
- No rainbow, no flicker, no empty cards.
- `npx tsc --noEmit` + `npm run build` clean.
- Verified with Playwright, actually inspected, at a Figma-community-feature bar.
