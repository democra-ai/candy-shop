/**
 * MostPopularRail — Aisle 01 horizontal scroller (DESIGN.md v2).
 *
 * Clean-canvas cards: bg-card + flavor top-accent + the category candy
 * illustration in a tinted well carries the color. No saturated full fills.
 *
 *   +----------------------------------+
 *   | ========= flavor accent ======== |
 *   | #1 (hot)         [candy well]     | <- rank pill + illustration well
 *   | category                         | <- category chip (tint/ink)
 *   | Frontend Design                  | <- title (line-clamp-2, hero)
 *   | @anthropic · 4.6 · 27k           | <- single mono meta line
 *   +----------------------------------+
 *
 * No description, no tags, no run button — those live in the modal.
 */

import { useMemo, useState, useRef } from 'react';
import { Star, ChevronLeft, ChevronRight, Flame, Users, ArrowRight } from 'lucide-react';
import { SKILLS_DATA, type Skill } from '../../data/skillsData';
import { cn } from '../../utils/cn';
import { SkillModal } from '../common/SkillModal';
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

export function MostPopularRail({ onRunSkill }: MostPopularRailProps) {
  const isDark = useIsDark();
  const [modalSkill, setModalSkill] = useState<Skill | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const popular = useMemo(
    () => [...SKILLS_DATA].sort((a, b) => b.popularity - a.popularity).slice(0, 10),
    []
  );

  const scrollBy = (delta: number) => {
    railRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <>
      <section className="py-8 md:py-10 relative">
        <div className="container max-w-7xl mx-auto px-0">
          {/* Aisle eyebrow */}
          <div className="flex items-end justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/12 text-rose-500 text-[10px] font-mono font-bold uppercase tracking-widest border border-rose-500/25">
                aisle 01
              </span>
              <h2 className="text-2xl md:text-3xl font-candy font-bold text-foreground tracking-tight">
                Most popular this week
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-foreground-tertiary font-mono text-[11px] uppercase tracking-widest hidden md:block mr-2">
                sorted by installs
              </p>
              <button
                onClick={() => scrollBy(-360)}
                className="w-9 h-9 rounded-full bg-card border border-border hover:border-rose-400 hover:text-rose-500 transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 shadow-candy-1 dark:shadow-candy-1-dark"
                aria-label="scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollBy(360)}
                className="w-9 h-9 rounded-full bg-card border border-border hover:border-rose-400 hover:text-rose-500 transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 shadow-candy-1 dark:shadow-candy-1-dark"
                aria-label="scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Horizontal rail */}
          <div className="relative">
            <div
              ref={railRef}
              className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-3 -mx-4 px-4"
              style={{ scrollPaddingLeft: '1rem' }}
            >
              {popular.map((skill, i) => {
                const flavor = getFlavor(skill.category, isDark);
                const emoji = getCandyEmoji(skill.id);
                const rating = skill.rating ?? 4.5 + (i % 5) * 0.1;
                const authorHandle = skill.developer ?? skill.repo?.split('/')[0];
                const isHotRank = i < 3;
                return (
                  <button
                    key={skill.id}
                    onClick={() => setModalSkill(skill)}
                    className={cn(
                      'group relative shrink-0 snap-start text-left',
                      'w-[240px] sm:w-[260px] h-[210px]',
                      'rounded-2xl p-4 pt-5 overflow-hidden bg-card border border-border',
                      'shadow-candy-1 dark:shadow-candy-1-dark',
                      'hover:-translate-y-1 hover:shadow-candy-2 dark:hover:shadow-candy-2-dark',
                      'transition-[transform,box-shadow,border-color] duration-300 ease-candy cursor-pointer',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      flavor.ring,
                    )}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = flavor.base; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
                  >
                    {/* flavor top-accent */}
                    <div className="absolute inset-x-0 top-0 h-[3px] opacity-80 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: flavor.base }} aria-hidden="true" />

                    {/* Content stack */}
                    <div className="relative h-full flex flex-col">
                      {/* Top row: rank pill + illustration well */}
                      <div className="flex items-start justify-between">
                        <div
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-widest text-white"
                          style={{ backgroundColor: flavor.base }}
                        >
                          #{i + 1}
                          {isHotRank && <Flame className="w-3 h-3" />}
                        </div>
                        <div
                          className="flex items-center justify-center w-11 h-11 rounded-xl text-2xl leading-none transition-transform duration-300 ease-candy group-hover:scale-105"
                          style={{ backgroundColor: flavor.tint }}
                          aria-hidden="true"
                        >
                          {emoji}
                        </div>
                      </div>

                      {/* category chip */}
                      <span
                        className="mt-3 inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-widest truncate max-w-full"
                        style={{ backgroundColor: flavor.tint, color: flavor.ink }}
                      >
                        {skill.category}
                      </span>

                      {/* Title — hero of the card */}
                      <h3
                        className="mt-2 font-candy font-semibold text-base md:text-lg leading-[1.15] line-clamp-2 text-foreground"
                        title={skill.name}
                      >
                        {skill.name}
                      </h3>

                      {/* Meta — single mono row at bottom */}
                      <div className="mt-auto pt-2 flex items-center gap-1.5 text-[10px] md:text-[11px] font-mono min-w-0 text-foreground-tertiary">
                        {authorHandle && (
                          <>
                            <span className="truncate max-w-[80px]">@{authorHandle}</span>
                            <span aria-hidden className="opacity-50">·</span>
                          </>
                        )}
                        <span className="flex items-center gap-0.5 shrink-0" style={{ color: flavor.ink }}>
                          <Star className="w-2.5 h-2.5 fill-current" />
                          <span className="font-bold">{rating.toFixed(1)}</span>
                        </span>
                        <span aria-hidden className="opacity-50">·</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Users className="w-2.5 h-2.5" />
                          {formatInstalls(skill.popularity)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {/* end-cap "see all" tile */}
              <button
                onClick={() => document.getElementById('skills-grid')?.scrollIntoView({ behavior: 'smooth' })}
                className="group shrink-0 snap-start w-[160px] h-[210px] rounded-2xl border-2 border-dashed border-border bg-card/40 hover:border-rose-400 hover:text-rose-500 transition-colors flex flex-col items-center justify-center gap-3 text-foreground-tertiary cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
              >
                <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-500/10 group-hover:bg-rose-500/15 transition-colors">
                  <ArrowRight className="w-5 h-5 text-rose-500 transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="font-candy font-bold text-sm text-foreground">see all candy</span>
                <span className="text-[10px] font-mono uppercase tracking-widest">browse the jar</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <SkillModal skill={modalSkill} onClose={() => setModalSkill(null)} onRun={onRunSkill} />
    </>
  );
}
