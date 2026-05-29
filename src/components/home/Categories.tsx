import { useMemo } from 'react';
import { Layers, Check } from 'lucide-react';
import { SKILLS_DATA, SKILL_CATEGORIES, REGISTRY_STATS } from '../../data/skillsData';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsDark } from '../../hooks/useIsDark';
import { getFlavor, flavorForCategory } from '../../utils/candyShells';
import { cn } from '../../utils/cn';

export interface CategoryData {
  name: string;
  icon: string;
  count: number;
  color: string;
}

// Per-category "flavor name" label under the title (the boutique copy). Color is
// carried by the candy emoji + flavor accent, NOT a neon gradient fill.
const FLAVOR_LABEL: Record<string, string> = {
  Development: 'Raspberry Bar',
  Design: 'Grape Swirl',
  Marketing: 'Caramel Cube',
  Productivity: 'Mint Drop',
  Tools: 'Chocolate Square',
  Research: 'Blueberry Gum',
  Mobile: 'Lemon Drop',
  Writing: 'Bubblegum Twist',
};

// Per-category candy emoji shown in the tinted well (back to emoji per owner).
const CATEGORY_EMOJI: Record<string, string> = {
  Development: '🍭',
  Design: '🍬',
  Marketing: '🧁',
  Productivity: '🍫',
  Tools: '🍰',
  Research: '🍡',
  Mobile: '🍪',
  Writing: '🍩',
};
const DEFAULT_CATEGORY_EMOJI = '🍮';

export function Categories({ onSelectCategory, activeCategory }: { onSelectCategory: (category: string | null) => void; activeCategory?: string | null }) {
  const { t } = useLanguage();
  const isDark = useIsDark();

  const categories = useMemo<CategoryData[]>(() => {
    return SKILL_CATEGORIES.map(cat => ({
      ...cat,
      count: SKILLS_DATA.filter(skill => skill.category === cat.name).length
    })).filter(cat => cat.count > 0);
  }, []);

  const isAllActive = !activeCategory;

  return (
    <section className="py-14 relative" id="categories-section">
      <div className="container max-w-7xl mx-auto px-4">
        {/* Section eyebrow */}
        <div className="flex items-end justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <span
              className="grid place-items-center w-11 h-11 rounded-2xl bg-card border border-border shadow-candy-1 dark:shadow-candy-1-dark shrink-0 text-2xl leading-none"
              aria-hidden="true"
            >
              🍫
            </span>
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
              'hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-bold transition-all duration-300 border btn-press',
              isAllActive
                ? 'bg-foreground text-background border-foreground shadow-candy'
                : 'bg-card border-border text-foreground-secondary hover:border-primary/40 hover:text-foreground hover:shadow-candy-1 dark:hover:shadow-candy-1-dark'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            All Flavors · {REGISTRY_STATS.totalSkills.toLocaleString()}
          </button>
        </div>

        {/* Tile grid — clean card surfaces, color carried by the candy illustration
            + a thin flavor accent. Keeps the 2-row asymmetric layout on lg. */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 auto-rows-[minmax(140px,auto)]">
          {/* Mobile "All Flavors" tile */}
          <button
            onClick={() => onSelectCategory(null)}
            className={cn(
              'sm:hidden col-span-2 group relative overflow-hidden rounded-3xl border p-5 text-left transition-all duration-300 btn-press',
              'shadow-candy-1 dark:shadow-candy-1-dark hover:shadow-candy-2 dark:hover:shadow-candy-2-dark',
              isAllActive
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card border-border'
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'grid place-items-center w-12 h-12 rounded-2xl shrink-0',
                  isAllActive ? 'bg-background/15' : 'bg-secondary'
                )}
                aria-hidden="true"
              >
                <Layers className={cn('w-6 h-6', isAllActive ? 'text-background' : 'text-foreground-secondary')} />
              </span>
              <div>
                <div className="font-candy font-bold text-base">All Flavors</div>
                <div className={cn('text-xs font-mono', isAllActive ? 'opacity-80' : 'text-foreground-tertiary')}>
                  {REGISTRY_STATS.totalSkills.toLocaleString()} skills
                </div>
              </div>
            </div>
          </button>

          {categories.map((cat, i) => {
            const flavor = getFlavor(cat.name, isDark);
            const candyEmoji = CATEGORY_EMOJI[cat.name] ?? DEFAULT_CATEGORY_EMOJI;
            const flavorLabel = FLAVOR_LABEL[cat.name] ?? flavorForCategory(cat.name);
            const isActive = activeCategory === cat.name;
            // Asymmetric sizing: every 5th tile is bigger (lg only) → 2 rows of 8.
            const isBig = i === 0 || i === 4;

            return (
              <button
                key={cat.name}
                onClick={() => onSelectCategory(cat.name)}
                className={cn(
                  'group relative overflow-hidden rounded-3xl border text-left transition-all duration-300 btn-press',
                  'bg-card shadow-candy-1 dark:shadow-candy-1-dark',
                  'hover:-translate-y-1 hover:shadow-candy-2 dark:hover:shadow-candy-2-dark',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  flavor.ring,
                  isActive ? 'border-transparent' : 'border-border',
                  isBig ? 'lg:col-span-2 lg:row-span-1' : ''
                )}
                style={
                  isActive
                    ? { boxShadow: `inset 0 0 0 2px ${flavor.base}` }
                    : undefined
                }
                aria-pressed={isActive}
              >
                {/* Thin flavor accent bar across the top */}
                <span
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: flavor.base }}
                  aria-hidden="true"
                />

                <div className={cn('relative p-5 sm:p-6 flex flex-col justify-between', isBig ? 'min-h-[180px]' : 'min-h-[140px]')}>
                  <div className="flex items-start justify-between gap-2">
                    {/* Candy emoji in a soft flavor-tinted well */}
                    <span
                      className={cn(
                        'flex items-center justify-center rounded-2xl shrink-0 leading-none transition-transform duration-300 ease-candy group-hover:scale-105 group-hover:-rotate-3',
                        isBig ? 'w-16 h-16 text-4xl' : 'w-12 h-12 text-2xl'
                      )}
                      style={{ backgroundColor: flavor.tint }}
                      aria-hidden="true"
                    >
                      {candyEmoji}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tabular-nums"
                      style={{ backgroundColor: flavor.tint, color: flavor.ink }}
                    >
                      {cat.count}
                    </span>
                  </div>

                  <div className="mt-3 min-w-0">
                    <h3 className={cn(
                      'font-candy font-bold text-foreground leading-tight break-words hyphens-auto line-clamp-2',
                      isBig ? 'text-lg sm:text-2xl' : 'text-[15px] sm:text-lg'
                    )}>
                      {cat.name}
                    </h3>
                    <p
                      className="mt-1 text-[11px] font-mono uppercase tracking-wider truncate"
                      style={{ color: flavor.ink }}
                    >
                      {flavorLabel}
                    </p>
                  </div>

                  {isActive && (
                    <span
                      className="absolute bottom-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-white shadow-candy-1 dark:shadow-candy-1-dark"
                      style={{ backgroundColor: flavor.base }}
                    >
                      <Check className="w-2.5 h-2.5" />
                      tasting
                    </span>
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
