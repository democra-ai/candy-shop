import { useState, useMemo } from 'react';
import { ArrowUpRight, Sparkles, Flame } from 'lucide-react';
import { SKILLS_DATA, type Skill } from '../../data/skillsData';
import { cn } from '../../utils/cn';
import { SkillModal } from '../common/SkillModal';
import { useIsDark } from '../../hooks/useIsDark';
import { getFlavor } from '../../utils/candyShells';
import { getCandyEmoji } from '../../utils/candy';

interface ShopWindowProps {
  onRunSkill?: (skill: Skill) => void;
}

// Single static tagline — no rotation, no flicker
const MASCOT_TAGLINE = "fresh batch out of the oven";

export function ShopWindow({ onRunSkill }: ShopWindowProps) {
  const isDark = useIsDark();
  // Static class pair so Tailwind JIT reliably emits both light + dark elevation.
  const shadow1 = 'shadow-candy-1 dark:shadow-candy-1-dark';

  const [modalSkill, setModalSkill] = useState<Skill | null>(null);

  // The featured editor's-pick (deterministic — the first one)
  const featured = useMemo(
    () => SKILLS_DATA.find((s) => s.editorPick) ?? SKILLS_DATA[0],
    []
  );

  // Fresh batch: most recent 6 (we don't have createdAt for store data, so use the last N as a stand-in)
  const freshBatch = useMemo(() => SKILLS_DATA.slice(-6).reverse(), []);

  // New arrivals avatar row — pick a different slice
  const newArrivals = useMemo(() => SKILLS_DATA.slice(8, 14), []);

  const handleRun = (skill: Skill) => {
    if (onRunSkill) onRunSkill(skill);
    else setModalSkill(skill);
  };

  // Flavor tokens for the featured cell + the section mascot accent.
  const featuredFlavor = getFlavor(featured.category, isDark);
  const featuredEmoji = getCandyEmoji(featured.id);
  const mascotFlavor = getFlavor('Design', isDark); // grape — friendly mascot well
  const arrivalsFlavor = getFlavor('Marketing', isDark); // caramel
  const hotFlavor = getFlavor('Development', isDark); // raspberry brand

  return (
    <>
      <section className="pt-2 pb-8 md:pb-12 relative">
        <div className="container max-w-7xl mx-auto px-0">
          {/* Eyebrow */}
          <div className="flex items-end justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold uppercase tracking-widest border border-amber-400/30">
                shop window
              </span>
              <h2 className="text-xl md:text-2xl font-candy font-bold text-foreground tracking-tight">
                What's behind the glass today
              </h2>
            </div>
            <p className="text-foreground-tertiary font-mono text-[11px] uppercase tracking-widest hidden md:block">
              refreshed daily
            </p>
          </div>

          {/* Bento grid: 6-col layout */}
          <div className="grid grid-cols-2 md:grid-cols-6 grid-rows-[auto_auto_auto] md:grid-rows-[180px_180px] gap-3 md:gap-4">
            {/* Cell 1 — Featured editor's pick (clean card, illustration-carried color) */}
            <button
              onClick={() => handleRun(featured)}
              className={cn(
                'group relative col-span-2 md:col-span-3 md:row-span-2 row-span-1',
                'rounded-3xl p-6 md:p-8 overflow-hidden text-left',
                'min-h-[280px] md:min-h-0 bg-card border border-border',
                shadow1,
                'hover:shadow-candy-2 dark:hover:shadow-candy-2-dark',
                'hover:-translate-y-1 transition-[transform,box-shadow,border-color] duration-300 ease-candy cursor-pointer',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                featuredFlavor.ring,
              )}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = featuredFlavor.base; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
            >
              {/* thin flavor top-accent */}
              <div className="absolute inset-x-0 top-0 h-1 opacity-90" style={{ backgroundColor: featuredFlavor.base }} aria-hidden="true" />

              {/* Sparkle ribbon */}
              <div
                className="absolute top-5 left-5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest"
                style={{ backgroundColor: featuredFlavor.tint, color: featuredFlavor.ink }}
              >
                <Sparkles className="w-3 h-3" />
                editor's pick · today
              </div>

              {/* Big candy emoji in a tinted well — the color carrier */}
              <div
                className="absolute right-6 top-16 flex items-center justify-center w-24 h-24 md:w-28 md:h-28 rounded-3xl text-6xl md:text-7xl leading-none transition-transform duration-300 ease-candy group-hover:scale-105 group-hover:-rotate-3"
                style={{ backgroundColor: featuredFlavor.tint }}
                aria-hidden="true"
              >
                {featuredEmoji}
              </div>

              {/* Content */}
              <div className="relative h-full flex flex-col justify-end pt-16">
                <span
                  className="inline-block w-fit px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-widest mb-2"
                  style={{ backgroundColor: featuredFlavor.tint, color: featuredFlavor.ink }}
                >
                  {featured.category}
                </span>
                <h3 className="font-candy font-bold text-3xl md:text-5xl leading-[0.98] mb-3 max-w-md text-foreground">
                  {featured.name}
                </h3>
                <p className="text-sm md:text-base font-body leading-relaxed line-clamp-2 max-w-md mb-5 text-foreground-secondary">
                  {featured.description}
                </p>
                <div
                  className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-full text-xs md:text-sm font-body font-bold tracking-tight text-white"
                  style={{ backgroundColor: featuredFlavor.base }}
                >
                  run candy
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            </button>

            {/* Cell 2 — Mascot greeter (Pip, the ONE mascot per view) */}
            <div
              className={cn(
                'relative col-span-2 md:col-span-2 row-span-1 rounded-3xl p-5 overflow-hidden',
                'min-h-[160px] bg-card border border-border', shadow1,
              )}
            >
              <div className="absolute top-4 right-4 inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-widest text-foreground-tertiary">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mascotFlavor.base }} />
                live
              </div>
              {/* Mascot — gentle idle bob (the single idle animation for this view) */}
              <div
                className="flex items-center justify-center w-[72px] h-[72px] md:w-[84px] md:h-[84px] rounded-3xl text-5xl md:text-6xl leading-none motion-safe:animate-float"
                style={{ backgroundColor: mascotFlavor.tint }}
                aria-hidden="true"
              >
                🍭
              </div>
              <div className="absolute bottom-5 left-5 right-5">
                <p className="text-[10px] font-mono uppercase tracking-widest mb-1 text-foreground-tertiary">
                  pip says
                </p>
                <p className="font-candy font-bold text-base md:text-lg leading-snug text-foreground">
                  {MASCOT_TAGLINE}
                </p>
              </div>
            </div>

            {/* Cell 3 — Today's new arrivals (clean card + caramel accents) */}
            <div className={cn(
              'relative col-span-1 md:col-span-1 row-span-1 rounded-3xl p-4 overflow-hidden min-h-[160px]',
              'bg-card border border-border', shadow1,
            )}>
              <div className="absolute top-3 right-3 text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: arrivalsFlavor.ink }}>
                new
              </div>
              <div className="flex flex-col h-full justify-between">
                <div>
                  <div className="font-candy font-black text-3xl leading-none tabular-nums" style={{ color: arrivalsFlavor.base }}>+{newArrivals.length}</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest mt-1 text-foreground-tertiary">
                    candies today
                  </div>
                </div>
                <div className="flex -space-x-2 mt-2">
                  {newArrivals.slice(0, 5).map((s) => {
                    const f = getFlavor(s.category, isDark);
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleRun(s)}
                        title={s.name}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-lg leading-none hover:scale-110 hover:z-10 transition-transform cursor-pointer ring-2 ring-card"
                        style={{ backgroundColor: f.tint }}
                      >
                        {getCandyEmoji(s.id)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cell 4 — Hot Out The Oven (clean wide strip + raspberry accents) */}
            <div className={cn(
              'relative col-span-2 md:col-span-6 row-span-1 rounded-3xl p-4 md:p-5 overflow-hidden min-h-[140px]',
              'bg-card border border-border', shadow1,
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4" style={{ color: hotFlavor.base }} />
                  <span className="font-candy font-bold text-base md:text-lg text-foreground">Hot out the oven</span>
                  <span className="text-[10px] font-mono uppercase tracking-widest hidden sm:inline text-foreground-tertiary">
                    · fresh batch · still warm
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-foreground-tertiary">
                  {freshBatch.length} items
                </span>
              </div>
              <div className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                {freshBatch.map((s) => {
                  const f = getFlavor(s.category, isDark);
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleRun(s)}
                      className={cn(
                        'group/chip shrink-0 flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-2xl',
                        'bg-secondary/50 border border-border hover:border-[color:var(--chip-accent)] hover:bg-secondary',
                        'transition-all duration-200 ease-candy cursor-pointer',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                        f.ring,
                      )}
                      style={{ ['--chip-accent' as string]: f.base }}
                    >
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-xl text-lg leading-none shrink-0"
                        style={{ backgroundColor: f.tint }}
                      >
                        {getCandyEmoji(s.id)}
                      </span>
                      <div className="text-left min-w-0">
                        <div className="text-xs font-candy font-bold truncate max-w-[140px] text-foreground">
                          {s.name}
                        </div>
                        <div className="text-[10px] font-mono truncate max-w-[140px] text-foreground-tertiary">
                          {s.category}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SkillModal skill={modalSkill} onClose={() => setModalSkill(null)} onRun={handleRun} />
    </>
  );
}
