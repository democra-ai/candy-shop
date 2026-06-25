/**
 * MostPopularRail — "Top chart this week" (DESIGN.md v2).
 *
 * Editorial Top-Chart layout (borrowed from Apple App Store "Today" feature
 * cards + Spotify/Product Hunt ranked-list rows): a richly-filled #1 hero on
 * the left and a dense ranked list of #2–#6 on the right. No empty cards.
 *
 *   ┌─ #1 hero ─────────┐  ┌─ ranked list ───────────────────┐
 *   │ ▔ flavor accent ▔ │  │ 02  ◍  Title          ★4.8  27k │
 *   │ TOP THIS WEEK     │  │ ───────────────────────────────  │
 *   │   ◍  (big emoji)  │  │ 03  ◍  Title          ★4.7  19k │
 *   │ Frontend Design   │  │ ───────────────────────────────  │
 *   │ two-line blurb…   │  │ 04  ◍  Title          ★4.6  12k │
 *   │ @anthropic ★ 27k  │  │ ───────────────────────────────  │
 *   │ [ Run ]    View → │  │ 05  ◍  Title          ★4.5   9k │
 *   └───────────────────┘  └─────────────────────────────────┘
 *
 * Clean canvas: bg-card / soft flavor tint wells; color carried by the candy
 * emoji + flavor accents. Clicking a row/hero opens the canonical detail page
 * (/candy/:id); the hero's Run button calls onRunSkill directly.
 */

import { useMemo } from 'react';
import { Star, Users, ArrowRight, Play, Crown } from 'lucide-react';
import { SKILLS_DATA, type Skill } from '../../data/skillsData';
import { cn } from '../../utils/cn';
import { useNavigate } from 'react-router-dom';
import { useIsDark } from '../../hooks/useIsDark';
import { getFlavor } from '../../utils/candyShells';
import { getCandyEmoji } from '../../utils/candy';

interface MostPopularRailProps {
  onRunSkill: (skill: Skill) => void;
}

function formatInstalls(n: number | undefined): string {
  if (!n || n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function ratingFor(skill: Skill, i: number): number {
  return skill.rating ?? 4.5 + (i % 5) * 0.1;
}

function authorFor(skill: Skill): string | undefined {
  return skill.developer ?? skill.repo?.split('/')[0];
}

export function MostPopularRail({ onRunSkill }: MostPopularRailProps) {
  const isDark = useIsDark();
  const navigate = useNavigate();

  const popular = useMemo(
    () => [...SKILLS_DATA].sort((a, b) => b.popularity - a.popularity).slice(0, 6),
    []
  );

  if (popular.length === 0) return null;

  const hero = popular[0];
  const rest = popular.slice(1);
  const heroFlavor = getFlavor(hero.category, isDark);
  const heroAuthor = authorFor(hero);
  const heroRating = ratingFor(hero, 0);

  return (
    <>
      <section className="py-8 md:py-12 relative" data-qa="rail">
        <div className="container max-w-7xl mx-auto px-0">
          {/* Section header */}
          <div className="flex items-end justify-between gap-4 mb-5 md:mb-6">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.16em] text-rose-500/90">
                top chart · this week
              </span>
              <h2 className="text-2xl md:text-3xl font-candy font-bold text-foreground tracking-tight leading-none">
                Most popular this week
              </h2>
            </div>
            <button
              onClick={() => document.getElementById('skills-grid')?.scrollIntoView({ behavior: 'smooth' })}
              className="group hidden sm:inline-flex items-center gap-1.5 shrink-0 text-sm font-body font-semibold text-foreground-secondary hover:text-rose-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 rounded-lg px-1 py-0.5"
            >
              see all
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* 2-col: hero feature + ranked list. Stacks on mobile. */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,38%)_minmax(0,1fr)] gap-3 md:gap-4 lg:gap-5 items-stretch">
            {/* ── #1 HERO — "skill of the week" ───────────────────────── */}
            {/* Outer is a div (not a button) so the inner Run can be a real
                button without nesting interactive elements. */}
            <div
              role="button"
              tabIndex={0}
              aria-label={`Open ${hero.name}`}
              onClick={() => navigate(`/candy/${hero.id}`, { state: { skill: hero } })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/candy/${hero.id}`, { state: { skill: hero } }); } }}
              className={cn(
                'group relative overflow-hidden text-left',
                'rounded-3xl p-5 md:p-6 border border-border',
                'shadow-candy-1 dark:shadow-candy-1-dark',
                'hover:-translate-y-1 hover:shadow-candy-2 dark:hover:shadow-candy-2-dark',
                'transition-[transform,box-shadow,border-color] duration-300 ease-candy cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                heroFlavor.ring,
              )}
              style={{ backgroundColor: heroFlavor.tint }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = heroFlavor.base; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
            >
              {/* faint oversized emoji watermark, bottom-right */}
              <span
                className="pointer-events-none absolute -bottom-6 -right-3 text-[120px] leading-none opacity-[0.07] select-none rotate-[-8deg]"
                aria-hidden="true"
              >
                {getCandyEmoji(hero.id)}
              </span>

              <div className="relative flex h-full flex-col">
                {/* eyebrow ribbon */}
                <span
                  className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-white shadow-sm"
                  style={{ backgroundColor: heroFlavor.base }}
                >
                  <Crown className="w-3 h-3" />
                  top this week
                </span>

                {/* big candy emoji in a tinted well */}
                <span
                  className="mt-4 md:mt-5 flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl text-4xl md:text-5xl leading-none bg-card shadow-candy-1 dark:shadow-candy-1-dark transition-transform duration-300 ease-candy group-hover:scale-105 group-hover:-rotate-3"
                  aria-hidden="true"
                >
                  {getCandyEmoji(hero.id)}
                </span>

                {/* category chip */}
                <span
                  className="mt-4 inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-widest bg-card"
                  style={{ color: heroFlavor.ink }}
                >
                  {hero.category}
                </span>

                {/* title */}
                <h3
                  className="mt-2 font-candy font-bold text-xl md:text-2xl leading-[1.1] line-clamp-2 text-foreground tracking-tight"
                  title={hero.name}
                >
                  {hero.name}
                </h3>

                {/* 2-line description */}
                <p className="mt-2 text-[13px] md:text-sm font-body leading-[1.5] line-clamp-2 text-foreground-secondary">
                  {hero.description}
                </p>

                {/* meta row — pushed to the bottom of the stretched hero */}
                <div className="mt-auto pt-4 flex items-center gap-2 text-[11px] md:text-xs font-mono text-foreground-tertiary min-w-0">
                  {heroAuthor && (
                    <>
                      <span className="truncate max-w-[120px]">@{heroAuthor}</span>
                      <span aria-hidden className="opacity-40">·</span>
                    </>
                  )}
                  <span className="flex items-center gap-0.5 shrink-0" style={{ color: heroFlavor.ink }}>
                    <Star className="w-3 h-3 fill-current" />
                    <span className="font-bold">{heroRating.toFixed(1)}</span>
                  </span>
                  <span aria-hidden className="opacity-40">·</span>
                  <span className="flex items-center gap-0.5 shrink-0">
                    <Users className="w-3 h-3" />
                    {formatInstalls(hero.popularity)}
                  </span>
                </div>

                {/* footer: Run + View affordance */}
                <div className="mt-4 md:mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRunSkill(hero); }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-sm font-body font-semibold text-white shadow-candy-1 dark:shadow-candy-1-dark transition-transform duration-150 ease-candy active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    style={{ backgroundColor: heroFlavor.base }}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Run candy
                  </button>
                  <span className="inline-flex items-center gap-1 text-sm font-body font-semibold text-foreground-secondary group-hover:text-foreground transition-colors">
                    View
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* ── RANKED LIST #2–#6 ───────────────────────────────────── */}
            <div className="rounded-3xl border border-border bg-card shadow-candy-1 dark:shadow-candy-1-dark overflow-hidden">
              <ul className="flex flex-col divide-y divide-border">
                {rest.map((skill, idx) => {
                  const rank = idx + 2; // #2..#6
                  const flavor = getFlavor(skill.category, isDark);
                  const author = authorFor(skill);
                  const rating = ratingFor(skill, rank - 1);
                  return (
                    <li key={skill.id}>
                      <button
                        onClick={() => navigate(`/candy/${skill.id}`, { state: { skill } })}
                        className={cn(
                          'group/row relative w-full text-left flex items-center gap-3 md:gap-4',
                          'px-4 md:px-5 py-3 md:py-3.5',
                          'transition-colors duration-200 ease-candy cursor-pointer',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                          flavor.ring,
                        )}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = flavor.tint;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '';
                        }}
                      >
                        {/* left flavor accent bar on hover */}
                        <span
                          className="absolute left-0 inset-y-0 w-1 rounded-r opacity-0 group-hover/row:opacity-100 transition-opacity"
                          style={{ backgroundColor: flavor.base }}
                          aria-hidden="true"
                        />

                        {/* big rank numeral */}
                        <span
                          className="font-candy font-bold text-2xl md:text-3xl leading-none tabular-nums w-8 md:w-9 text-center shrink-0 transition-transform duration-200 ease-candy group-hover/row:translate-x-1"
                          style={{ color: flavor.base }}
                          aria-hidden="true"
                        >
                          {String(rank).padStart(2, '0')}
                        </span>

                        {/* emoji well */}
                        <span
                          className="flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl text-xl md:text-2xl leading-none shrink-0 transition-transform duration-200 ease-candy group-hover/row:scale-105"
                          style={{ backgroundColor: flavor.tint }}
                          aria-hidden="true"
                        >
                          {getCandyEmoji(skill.id)}
                        </span>

                        {/* title + author */}
                        <span className="flex flex-col min-w-0 flex-1">
                          <span
                            className="font-candy font-semibold text-sm md:text-[15px] leading-tight truncate text-foreground"
                            title={skill.name}
                          >
                            {skill.name}
                          </span>
                          <span className="font-mono text-[11px] text-foreground-tertiary truncate">
                            {author ? `@${author}` : skill.category}
                          </span>
                        </span>

                        {/* right meta: rating + installs */}
                        <span className="flex items-center gap-3 md:gap-4 shrink-0 font-mono text-[11px] md:text-xs">
                          <span className="flex items-center gap-0.5" style={{ color: flavor.ink }}>
                            <Star className="w-3 h-3 fill-current" />
                            <span className="font-bold">{rating.toFixed(1)}</span>
                          </span>
                          <span className="flex items-center gap-1 text-foreground-tertiary tabular-nums min-w-[44px] justify-end">
                            <Users className="w-3 h-3" />
                            {formatInstalls(skill.popularity)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* mobile see-all */}
          <button
            onClick={() => document.getElementById('skills-grid')?.scrollIntoView({ behavior: 'smooth' })}
            className="group sm:hidden mt-4 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-border bg-card text-sm font-body font-semibold text-foreground-secondary hover:border-rose-400 hover:text-rose-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
          >
            see all candy
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>
    </>
  );
}
