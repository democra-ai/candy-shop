import { useState, useMemo } from 'react';
import { ArrowUpRight, Sparkles, Star, Layers } from 'lucide-react';
import { SKILLS_DATA, type Skill } from '../../data/skillsData';
import { cn } from '../../utils/cn';
import { SkillModal } from '../common/SkillModal';
import { useIsDark } from '../../hooks/useIsDark';
import { getFlavor } from '../../utils/candyShells';
import { getCandyEmoji } from '../../utils/candy';

/**
 * ShopWindow — "What's behind the glass today" (DESIGN.md v2).
 *
 * A daily EDITORIAL showcase, modelled on the Apple App Store "Today" tab and the
 * balanced bento discipline of Linear / Stripe / Apple Music / Vercel. This is the
 * curated voice of the shop — deliberately DISTINCT from MostPopularRail (the
 * by-installs Top Chart directly below). Where the Top Chart ranks by popularity,
 * this section speaks in a human curator's voice: an Editor's Pick with a hand-
 * written note, a scannable list of what's new, and a themed staff collection.
 *
 * Layout — an equal-height 2-row bento (the App Store / Apple-Music pattern: a tall
 * hero feature on the left + two stacked supporting cards on the right, all sharing
 * ONE fixed row height so every cell's baseline aligns; no stubs, no mismatched gaps):
 *
 *   ┌─ EDITOR'S PICK · TODAY ─────┐  ┌─ NEW THIS WEEK ───────────┐
 *   │ ▔ flavor accent ▔           │  │ ◍ Name              cat → │
 *   │            ◍ (candy)        │  │ ◍ Name              cat → │
 *   │ Category                    │  │ ◍ Name              cat → │
 *   │ Big Fredoka Title           │  └───────────────────────────┘
 *   │ Curator's note (1–2 lines)  │  ┌─ STAFF COLLECTION ────────┐
 *   │ @dev · ★ rating             │  │ ◍◍◍  Themed title         │
 *   │ [ run candy ↗ ]             │  │ one-line blurb · N candies│
 *   └─────────────────────────────┘  └───────────────────────────┘
 *
 * Patterns borrowed (and adapted to the candy system):
 *  • Apple App Store "Today": uppercase kicker → big title → one-line subtitle →
 *    clean visual, generous consistent padding, rounded editorial cards.
 *  • Vercel: emphasise the primary card through CONTENT DEPTH (the hero carries the
 *    rich note + meta + CTA) while supporting cards stay tidy; equal-height rows.
 *  • Linear / Stripe: eyebrow→title→copy hierarchy, one consistent gap scale,
 *    differentiate by proportion & spacing rather than louder colour.
 *  • Apple Music: asymmetric sizes read as balanced because every cell aligns to a
 *    shared row baseline with a uniform gutter.
 */

interface ShopWindowProps {
  onRunSkill?: (skill: Skill) => void;
}

// A named, themed staff collection — curated voice, NOT a popularity stat.
// Deterministic pick from the catalog so it never flickers.
const COLLECTION = {
  eyebrow: 'Staff collection',
  title: 'Ship a frontend in a weekend',
  blurb: 'Our favourite design, build & deploy candies, jarred together.',
  flavor: 'Design' as const, // grape
  // categories that make up the themed set
  pickFrom: ['Design', 'Development', 'Tools'] as const,
};

export function ShopWindow({ onRunSkill }: ShopWindowProps) {
  const isDark = useIsDark();
  const shadow1 = 'shadow-candy-1 dark:shadow-candy-1-dark';

  const [modalSkill, setModalSkill] = useState<Skill | null>(null);

  // Editor's pick hero — the curated skill (deterministic).
  const featured = useMemo(
    () => SKILLS_DATA.find((s) => s.editorPick) ?? SKILLS_DATA[0],
    []
  );

  // "New this week" — a tidy, scannable list of fresh skill NAMES (Apple "New &
  // Updated"). We have no createdAt, so the tail of the catalog stands in for new;
  // exclude the hero so nothing repeats across cells.
  const newThisWeek = useMemo(
    () => SKILLS_DATA.filter((s) => s.id !== featured.id).slice(-3).reverse(),
    [featured.id]
  );

  // Staff collection — a small themed cluster, distinct from both above.
  const collection = useMemo(() => {
    const used = new Set<string>([featured.id, ...newThisWeek.map((s) => s.id)]);
    const picks: Skill[] = [];
    for (const cat of COLLECTION.pickFrom) {
      const hit = SKILLS_DATA.find((s) => s.category === cat && !used.has(s.id));
      if (hit) { picks.push(hit); used.add(hit.id); }
    }
    // top up to 3 if a category was missing
    if (picks.length < 3) {
      for (const s of SKILLS_DATA) {
        if (picks.length >= 3) break;
        if (!used.has(s.id)) { picks.push(s); used.add(s.id); }
      }
    }
    return picks;
  }, [featured.id, newThisWeek]);

  const handleRun = (skill: Skill) => {
    if (onRunSkill) onRunSkill(skill);
    else setModalSkill(skill);
  };

  const featuredFlavor = getFlavor(featured.category, isDark);
  const featuredEmoji = getCandyEmoji(featured.id);
  const newFlavor = getFlavor('Mint', isDark); // mint — "new/fresh", reads calm
  const collFlavor = getFlavor(COLLECTION.flavor, isDark); // grape — curated set

  const featuredAuthor = featured.developer ?? featured.repo?.split('/')[0];
  const featuredNote = featured.editorNote ?? featured.description;
  const featuredRating = featured.rating ?? 4.8;

  // One row height drives the equal-height bento: hero spans 2 rows, the two
  // supporting cards each fill 1 — so the right column's combined height + gap
  // exactly matches the hero. Tuned so content sits comfortably.
  const ROW = 'md:grid-rows-[minmax(208px,auto)_minmax(208px,auto)]';

  return (
    <>
      <section className="pt-2 pb-8 md:pb-12 relative">
        <div className="container max-w-7xl mx-auto px-0">
          {/* Section header — restrained eyebrow + title (DESIGN.md §4) */}
          <div className="flex items-end justify-between gap-4 mb-5 md:mb-6">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.16em] text-foreground-tertiary">
                the shop window
              </span>
              <h2 className="text-2xl md:text-3xl font-candy font-bold text-foreground tracking-tight leading-none">
                What&apos;s behind the glass today
              </h2>
            </div>
            <p className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.16em] text-foreground-tertiary hidden sm:block shrink-0">
              curated · refreshed daily
            </p>
          </div>

          {/* Equal-height bento: hero (2 rows) + two stacked supporting cards. */}
          <div className={cn('grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4', ROW)}>
            {/* ── HERO — Editor's Pick · Today ───────────────────────────── */}
            <button
              onClick={() => handleRun(featured)}
              className={cn(
                'group relative md:col-span-7 md:row-span-2 overflow-hidden text-left',
                'rounded-3xl p-6 md:p-8 border border-border min-h-[300px] md:min-h-0',
                shadow1,
                'hover:shadow-candy-2 dark:hover:shadow-candy-2-dark hover:-translate-y-1',
                'transition-[transform,box-shadow,border-color] duration-300 ease-candy cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                featuredFlavor.ring,
              )}
              style={{ backgroundColor: featuredFlavor.tint }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = featuredFlavor.base; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
            >
              {/* thin flavor top-accent */}
              <div className="absolute inset-x-0 top-0 h-1 opacity-90 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: featuredFlavor.base }} aria-hidden="true" />

              {/* faint oversized candy watermark, bottom-right (App Store full-bleed art, candy-muted) */}
              <span
                className="pointer-events-none absolute -bottom-10 -right-6 text-[200px] leading-none opacity-[0.06] select-none rotate-[-8deg]"
                aria-hidden="true"
              >
                {featuredEmoji}
              </span>

              {/* big candy in a tinted well — floats top-right; consistent motif with the rail */}
              <span
                className="absolute top-6 right-6 md:top-8 md:right-8 flex items-center justify-center w-[84px] h-[84px] md:w-[104px] md:h-[104px] rounded-3xl text-5xl md:text-6xl leading-none bg-card shadow-candy-1 dark:shadow-candy-1-dark transition-transform duration-300 ease-candy group-hover:scale-105 group-hover:-rotate-3"
                aria-hidden="true"
              >
                {featuredEmoji}
              </span>

              <div className="relative flex h-full flex-col">
                {/* kicker — solid card chip so it reads on the tint */}
                <span
                  className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-[0.14em] bg-card"
                  style={{ color: featuredFlavor.ink }}
                >
                  <Sparkles className="w-3 h-3" />
                  editor&apos;s pick · today
                </span>

                {/* editorial block — anchored to the bottom (Apple Today: art up top,
                    text block low) so the hero never has a hollow middle. */}
                <div className="mt-auto pt-10">
                  {/* category chip */}
                  <span
                    className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-widest bg-card"
                    style={{ color: featuredFlavor.ink }}
                  >
                    {featured.category}
                  </span>

                  {/* title */}
                  <h3 className="mt-2.5 font-candy font-bold text-3xl md:text-[42px] leading-[1.02] tracking-tight line-clamp-2 max-w-md text-foreground">
                    {featured.name}
                  </h3>

                  {/* curator's note — the editorial voice (distinct from the Top Chart) */}
                  <p className="mt-3 text-sm md:text-base font-body leading-relaxed line-clamp-2 max-w-md text-foreground-secondary">
                    {featuredNote}
                  </p>
                </div>

                {/* meta + CTA */}
                <div className="pt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <span
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs md:text-sm font-body font-bold tracking-tight text-white shadow-candy-1 dark:shadow-candy-1-dark transition-transform duration-150 ease-candy group-active:translate-y-[1px]"
                    style={{ backgroundColor: featuredFlavor.base }}
                  >
                    run candy
                    <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[11px] md:text-xs text-foreground-tertiary min-w-0">
                    {featuredAuthor && (
                      <>
                        <span className="truncate max-w-[140px]">@{featuredAuthor}</span>
                        <span aria-hidden className="opacity-40">·</span>
                      </>
                    )}
                    <span className="flex items-center gap-0.5 shrink-0" style={{ color: featuredFlavor.ink }}>
                      <Star className="w-3 h-3 fill-current" />
                      <span className="font-bold">{featuredRating.toFixed(1)}</span>
                    </span>
                  </span>
                </div>
              </div>
            </button>

            {/* ── SUPPORTING 1 — New this week (scannable named list) ─────── */}
            <div
              className={cn(
                'relative md:col-span-5 md:row-span-1 overflow-hidden flex flex-col',
                'rounded-3xl p-5 border border-border', shadow1,
              )}
              style={{ backgroundColor: newFlavor.tint }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: newFlavor.ink }}>
                  new this week
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-foreground-tertiary">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: newFlavor.base }} />
                  just shelved
                </span>
              </div>
              <ul className="flex flex-1 flex-col justify-between gap-1 -mx-1.5">
                {newThisWeek.map((s) => {
                  const f = getFlavor(s.category, isDark);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => handleRun(s)}
                        className={cn(
                          'group/row w-full text-left flex items-center gap-3 rounded-2xl px-1.5 py-1.5',
                          'transition-colors duration-200 ease-candy cursor-pointer',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset', f.ring,
                        )}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                      >
                        <span
                          className="flex items-center justify-center w-9 h-9 rounded-xl text-lg leading-none shrink-0 transition-transform duration-200 ease-candy group-hover/row:scale-105"
                          style={{ backgroundColor: f.tint }}
                          aria-hidden="true"
                        >
                          {getCandyEmoji(s.id)}
                        </span>
                        <span className="flex flex-col min-w-0 flex-1">
                          <span className="font-candy font-semibold text-sm leading-tight truncate text-foreground" title={s.name}>
                            {s.name}
                          </span>
                          <span className="font-mono text-[10px] text-foreground-tertiary truncate">
                            {s.category}
                          </span>
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-foreground-tertiary opacity-0 -translate-x-1 transition-all duration-200 group-hover/row:opacity-100 group-hover/row:translate-x-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ── SUPPORTING 2 — Staff collection (themed curated set) ────── */}
            <button
              onClick={() => collection[0] && handleRun(collection[0])}
              className={cn(
                'group relative md:col-span-5 md:row-span-1 overflow-hidden text-left flex flex-col justify-between',
                'rounded-3xl p-5 border border-border min-h-[160px] md:min-h-0', shadow1,
                'hover:shadow-candy-2 dark:hover:shadow-candy-2-dark hover:-translate-y-1',
                'transition-[transform,box-shadow,border-color] duration-300 ease-candy cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background', collFlavor.ring,
              )}
              style={{ backgroundColor: collFlavor.tint }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = collFlavor.base; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: collFlavor.ink }}>
                  <Layers className="w-3 h-3" />
                  {COLLECTION.eyebrow}
                </span>
                {/* clustered candy emojis — a deliberate, consistent well motif */}
                <span className="flex -space-x-2.5" aria-hidden="true">
                  {collection.map((s) => {
                    const f = getFlavor(s.category, isDark);
                    return (
                      <span
                        key={s.id}
                        className="flex items-center justify-center w-9 h-9 rounded-2xl text-lg leading-none ring-2 ring-card transition-transform duration-200 ease-candy group-hover:-translate-y-0.5"
                        style={{ backgroundColor: f.tint }}
                      >
                        {getCandyEmoji(s.id)}
                      </span>
                    );
                  })}
                </span>
              </div>

              <div>
                <h3 className="font-candy font-bold text-lg md:text-xl leading-tight text-foreground line-clamp-2">
                  {COLLECTION.title}
                </h3>
                <p className="mt-1 text-[13px] font-body leading-snug text-foreground-secondary line-clamp-1">
                  {COLLECTION.blurb}
                </p>
                <span className="mt-2 inline-flex items-center gap-1.5 font-body text-xs font-semibold" style={{ color: collFlavor.ink }}>
                  Open collection
                  <span className="font-mono text-foreground-tertiary">· {collection.length} candies</span>
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: collFlavor.base }} />
                </span>
              </div>
            </button>
          </div>
        </div>
      </section>

      <SkillModal skill={modalSkill} onClose={() => setModalSkill(null)} onRun={handleRun} />
    </>
  );
}
