# Candy Shop illustration system

Custom SVG set that replaces ALL emoji-as-UI (DESIGN.md §0 rule 1, §6). One
style language: rounded geometry, a single flat fill (`color`) + one soft white
gloss + same-hue neutral shade for depth. No second hue per icon, no rainbow.

Every component takes `{ size?, color?, className? }` (+ native SVG props).
`color` defaults to the brand/flavor base. `viewBox` is `0 0 48 48` for icons,
`0 0 96 96` for the spots (EmptyJar / Counter) and Pip.

## For the propagation agents — how to swap emoji out

### Category candy (the main one — replaces `getCandyEmoji` / raw 🍭 in cards)
```tsx
import { getCandyIcon } from '@/components/illustrations';
import { getFlavor } from '@/utils/candyShells';

const Candy = getCandyIcon(skill.category);     // already the right flavor color
<Candy size={40} />

// In a tinted "well" (the calibrated card pattern), pair with getFlavor:
const f = getFlavor(skill.category, isDark);
<div className="flex items-center justify-center w-12 h-12 rounded-2xl"
     style={{ background: f.tint }}>
  <Candy size={28} color={f.base} />
</div>
```
`getCandyIcon` accepts a **category** ("Development") or a **flavor**
("Raspberry"); unknown input falls back to the brand candy.

### Logo (header / footer / auth)
```tsx
import { Logo, LogoMark } from '@/components/illustrations';
<Logo size={32} />            // mark + "Candy Shop" wordmark (Fredoka)
<LogoMark size={28} />        // mark only (favicons, tight spots)
```

### Mascot (use ONCE per view — DESIGN.md §1)
```tsx
import { Pip } from '@/components/illustrations';
<Pip size={96} />             // ShopWindow / hero / friendly empty state
```

### Empty / zero states
```tsx
import { EmptyJar, Counter } from '@/components/illustrations';
<EmptyJar size={96} />        // no skills / no results / empty library
<Counter size={96} />         // sign-in / auth empty state
```

### Decorative
```tsx
import { Sprinkles } from '@/components/illustrations';
<Sprinkles width={520} color={f.base} opacity={0.18}
           className="absolute inset-0 pointer-events-none" />
```
Keep it low-opacity and sparse — it's an accent, never the focus.

## Palette helpers (src/utils/candyShells.ts)

- `getFlavor(categoryOrFlavor, isDark) → { base, tint, ink }` — calibrated v2
  palette. `base` = vivid accent (illustration fill, badge, button, ring),
  `tint` = soft chip/well bg, `ink` = readable text on `tint`.
- `getCandyColor(categoryOrFlavor, isDark?) → string` — just the base.
- `flavorForCategory(category) → Flavor`, `CATEGORY_FLAVOR`, `BRAND_FLAVOR`.
- `getShell(...)` is UNCHANGED — existing `{bg,text,accent,chipBg,ring}` callers
  keep working. New surfaces should prefer `getFlavor` (clean canvas + accent).

## Tokens (tailwind.config.js)

- `shadow-candy-1|2|3` (+ `-dark` variants) — the §5 elevation scale.
- `ease-candy` — elastic `cubic-bezier(.34,1.56,.64,1)` for hover/mount/pops.

## Note: Fredoka font

The `Wordmark` needs **Fredoka** (`font-candy`). It's installed
(`@fontsource/fredoka`) but NOT yet imported in `src/index.css` — only Quicksand
is, so `font-candy` currently falls back to Quicksand. Add to `index.css` when
wiring the logo into the app:
```css
@import '@fontsource/fredoka/400.css';
@import '@fontsource/fredoka/500.css';
@import '@fontsource/fredoka/600.css';
@import '@fontsource/fredoka/700.css';
```

## QA preview

`/illustrations-preview.html` (entry `src/illustrations-preview.tsx`) renders the
whole set on light + dark. Screenshot: `node scripts/shoot-illustrations.mjs`.
