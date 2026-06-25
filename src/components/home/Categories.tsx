import { useMemo } from 'react';
import { SKILLS_DATA, SKILL_CATEGORIES, REGISTRY_STATS } from '../../data/skillsData';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../utils/cn';

export interface CategoryData {
  name: string;
  icon: string;
  count: number;
  color: string;
}

// Each category gets its own candy "flavor" — bold gradient + emoji set
const FLAVOR_MAP: Record<string, {
  bg: string;
  border: string;
  ring: string;
  emoji: string;
  emojiBg: string;
  label: string;
}> = {
  Development: {
    bg: 'from-indigo-400 via-blue-500 to-cyan-400',
    border: 'border-indigo-300',
    ring: 'ring-indigo-300/50',
    emoji: '🍭',
    emojiBg: 'bg-white/30',
    label: 'Blueberry Pop',
  },
  Design: {
    bg: 'from-pink-400 via-rose-500 to-fuchsia-400',
    border: 'border-pink-300',
    ring: 'ring-pink-300/50',
    emoji: '🍬',
    emojiBg: 'bg-white/30',
    label: 'Strawberry Swirl',
  },
  Marketing: {
    bg: 'from-orange-400 via-amber-500 to-yellow-400',
    border: 'border-orange-300',
    ring: 'ring-orange-300/50',
    emoji: '🧁',
    emojiBg: 'bg-white/30',
    label: 'Caramel Crunch',
  },
  Productivity: {
    bg: 'from-emerald-400 via-teal-500 to-green-400',
    border: 'border-emerald-300',
    ring: 'ring-emerald-300/50',
    emoji: '🍫',
    emojiBg: 'bg-white/30',
    label: 'Mint Chocolate',
  },
  Tools: {
    bg: 'from-violet-400 via-purple-500 to-fuchsia-500',
    border: 'border-violet-300',
    ring: 'ring-violet-300/50',
    emoji: '🍰',
    emojiBg: 'bg-white/30',
    label: 'Grape Gummy',
  },
  Research: {
    bg: 'from-cyan-400 via-sky-500 to-blue-400',
    border: 'border-cyan-300',
    ring: 'ring-cyan-300/50',
    emoji: '🍡',
    emojiBg: 'bg-white/30',
    label: 'Cotton Candy',
  },
  Mobile: {
    bg: 'from-lime-400 via-green-500 to-emerald-400',
    border: 'border-lime-300',
    ring: 'ring-lime-300/50',
    emoji: '🍪',
    emojiBg: 'bg-white/30',
    label: 'Apple Sour',
  },
  Writing: {
    bg: 'from-yellow-400 via-amber-500 to-orange-400',
    border: 'border-yellow-300',
    ring: 'ring-yellow-300/50',
    emoji: '🍩',
    emojiBg: 'bg-white/30',
    label: 'Honey Glaze',
  },
};

const DEFAULT_FLAVOR = {
  bg: 'from-slate-400 via-gray-500 to-zinc-400',
  border: 'border-slate-300',
  ring: 'ring-slate-300/50',
  emoji: '🍮',
  emojiBg: 'bg-white/30',
  label: 'House Special',
};

export function Categories({ onSelectCategory, activeCategory }: { onSelectCategory: (category: string | null) => void; activeCategory?: string | null }) {
  const { t } = useLanguage();

  const categories = useMemo<CategoryData[]>(() => {
    return SKILL_CATEGORIES.map(cat => ({
      ...cat,
      count: SKILLS_DATA.filter(skill => skill.category === cat.name).length
    })).filter(cat => cat.count > 0);
  }, []);

  const isAllActive = !activeCategory;

  return (
    <section className="py-14 relative" id="categories-section">
      <div className="w-full max-w-[1600px] mx-auto px-4">
        {/* Section eyebrow */}
        <div className="flex items-end justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍫</span>
            <div>
              <h2 className="text-2xl sm:text-3xl font-candy font-bold text-foreground leading-tight">
                Browse by Flavor
              </h2>
              <p className="text-xs sm:text-sm font-mono text-foreground-tertiary">
                Eight aisles · pick a flavor and dig in
              </p>
            </div>
          </div>

          <button
            onClick={() => onSelectCategory(null)}
            className={cn(
              'hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-bold transition-all duration-300 border-2 btn-press',
              isAllActive
                ? 'bg-foreground text-background border-foreground shadow-candy'
                : 'bg-card border-border/60 text-foreground-secondary hover:border-primary/40 hover:text-foreground'
            )}
          >
            🍬 All Flavors · {REGISTRY_STATS.totalSkills.toLocaleString()}
          </button>
        </div>

        {/* Bento tile grid — asymmetric on lg */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 auto-rows-[minmax(140px,auto)]">
          {/* Mobile "All Flavors" tile */}
          <button
            onClick={() => onSelectCategory(null)}
            className={cn(
              'sm:hidden col-span-2 group relative overflow-hidden rounded-3xl border-2 p-5 text-left transition-all duration-300 btn-press',
              isAllActive
                ? 'bg-foreground text-background border-foreground shadow-candy-lg'
                : 'bg-gradient-to-br from-rose-100 via-amber-50 to-mint/20 border-rose-200 hover:shadow-warm-lg'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🍬</span>
              <div>
                <div className="font-candy font-bold text-base">All Flavors</div>
                <div className="text-xs font-mono opacity-80">{REGISTRY_STATS.totalSkills.toLocaleString()} skills</div>
              </div>
            </div>
          </button>

          {categories.map((cat, i) => {
            const flavor = FLAVOR_MAP[cat.name] || DEFAULT_FLAVOR;
            const isActive = activeCategory === cat.name;
            // Asymmetric sizing: every 5th tile is bigger (lg only)
            const isBig = i === 0 || i === 4;

            return (
              <button
                key={cat.name}
                onClick={() => onSelectCategory(cat.name)}
                className={cn(
                  'group relative overflow-hidden rounded-3xl border-2 text-left transition-all duration-300 btn-press',
                  'shadow-candy hover:shadow-candy-lg hover:-translate-y-1',
                  'focus:outline-none focus:ring-4',
                  `bg-gradient-to-br ${flavor.bg}`,
                  flavor.border,
                  flavor.ring,
                  isActive ? 'ring-4 scale-[1.02]' : 'ring-0',
                  isBig ? 'lg:col-span-2 lg:row-span-1' : ''
                )}
              >
                {/* Sprinkle dots overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-30" aria-hidden="true"
                  style={{
                    backgroundImage: 'radial-gradient(circle, white 1px, transparent 1.5px)',
                    backgroundSize: '24px 24px',
                  }}
                />
                {/* Glossy top sheen */}
                <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

                <div className={cn('relative p-5 sm:p-6 flex flex-col justify-between', isBig ? 'min-h-[180px]' : 'min-h-[140px]')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn(
                      'flex items-center justify-center rounded-2xl backdrop-blur-sm border-2 border-white/60 shadow-lg shrink-0',
                      flavor.emojiBg,
                      isBig ? 'w-16 h-16 text-4xl' : 'w-12 h-12 text-2xl'
                    )}>
                      {flavor.emoji}
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-white/40 backdrop-blur-sm text-[10px] font-mono font-bold text-white border border-white/60">
                      {cat.count}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className={cn(
                      'font-candy font-bold text-white drop-shadow-md leading-tight',
                      isBig ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'
                    )}>
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-[11px] font-mono text-white/80 uppercase tracking-wider">
                      {flavor.label}
                    </p>
                  </div>

                  {isActive && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-white text-[10px] font-mono font-bold text-foreground shadow-md">
                      ✓ tasting
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sub-label */}
        <p className="mt-6 text-center text-xs font-mono text-foreground-tertiary">
          {t('categories.subtitle')}
        </p>
      </div>
    </section>
  );
}
