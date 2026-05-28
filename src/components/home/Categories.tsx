import { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { SKILLS_DATA, SKILL_CATEGORIES, REGISTRY_STATS } from '../../data/skillsData';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../utils/cn';
import { useIsDark } from '../../hooks/useIsDark';
import { getFlavor } from '../../utils/candyShells';
import { getCandyIcon } from '../illustrations';

export interface CategoryData {
  name: string;
  icon: string;
  count: number;
  color: string;
}

/**
 * Aisle 2 — "By Flavor" (DESIGN.md v2). Clean-canvas flavor tiles: each tile is a
 * neutral `bg-card` surface; the category candy ILLUSTRATION in a flavor well +
 * a tint count chip carry the color. Active tile gets a flavor border + ring.
 * No saturated full-fill blocks, no emoji.
 */

export function Categories({
  onSelectCategory,
  activeCategory,
}: {
  onSelectCategory: (category: string | null) => void;
  activeCategory?: string | null;
}) {
  const { t } = useLanguage();
  const isDark = useIsDark();

  const categories = useMemo<CategoryData[]>(() => {
    return SKILL_CATEGORIES.map((cat) => ({
      ...cat,
      count: SKILLS_DATA.filter((skill) => skill.category === cat.name).length,
    })).filter((cat) => cat.count > 0);
  }, []);

  const isAllActive = !activeCategory;

  return (
    <section className="py-10 relative" id="categories-section">
      <div className="relative container max-w-7xl mx-auto px-0">
        {/* Aisle eyebrow header */}
        <div className="flex items-end justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-500/12 text-violet-500 text-[10px] font-mono font-bold uppercase tracking-widest border border-violet-500/25">
              aisle 02
            </span>
            <h2 className="text-2xl md:text-3xl font-candy font-bold text-foreground tracking-tight">
              {t('categories.title') || 'By flavor'}
            </h2>
          </div>
          <p className="text-foreground-tertiary font-mono text-[11px] uppercase tracking-widest hidden md:block">
            {SKILL_CATEGORIES.length} categories · pick a flavor
          </p>
        </div>

        {/* Tile grid — 9 tiles (ALL + 8 categories) in a clean 3/5/9 grid.
            grid-flow-dense backstops any future tile count mismatch. */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5 md:gap-3 grid-flow-dense">
          {/* ALL tile — neutral surface, brand-raspberry accent + grid glyph */}
          <button
            onClick={() => onSelectCategory(null)}
            className={cn(
              'group relative overflow-hidden rounded-2xl text-left p-3 md:p-4',
              'aspect-[1.1/1] md:aspect-square bg-card border border-border',
              'shadow-candy-1 dark:shadow-candy-1-dark',
              'hover:-translate-y-0.5 hover:shadow-candy-2 dark:hover:shadow-candy-2-dark',
              'transition-[transform,box-shadow,border-color] duration-200 ease-candy cursor-pointer',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-rose-300',
              isAllActive && 'ring-2 ring-offset-2 ring-offset-background ring-rose-400 border-rose-400',
            )}
          >
            <div className="relative h-full flex flex-col justify-between">
              <span
                className="flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-xl"
                style={{ backgroundColor: 'var(--color-secondary)' }}
              >
                <LayoutGrid className="w-5 h-5 text-primary" />
              </span>
              <div>
                <div className="font-candy font-bold leading-tight text-sm md:text-base text-foreground">
                  All flavors
                </div>
                <div className="mt-1 inline-block px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-secondary text-foreground-secondary">
                  {REGISTRY_STATS.totalSkills.toLocaleString()}
                </div>
              </div>
            </div>
          </button>

          {categories.map((cat) => {
            const flavor = getFlavor(cat.name, isDark);
            const Candy = getCandyIcon(cat.name, isDark);
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => onSelectCategory(cat.name)}
                className={cn(
                  'group relative overflow-hidden rounded-2xl text-left p-3 md:p-4',
                  'aspect-[1.1/1] md:aspect-square bg-card border border-border',
                  'shadow-candy-1 dark:shadow-candy-1-dark',
                  'hover:-translate-y-0.5 hover:shadow-candy-2 dark:hover:shadow-candy-2-dark',
                  'transition-[transform,box-shadow,border-color] duration-200 ease-candy cursor-pointer',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  flavor.ring,
                  isActive && 'ring-2 ring-offset-2 ring-offset-background',
                )}
                style={isActive
                  ? { borderColor: flavor.base, ['--tw-ring-color' as string]: flavor.base }
                  : undefined}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = flavor.base; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = ''; }}
              >
                <div className="relative h-full flex flex-col justify-between">
                  <span
                    className="flex items-center justify-center w-11 h-11 md:w-12 md:h-12 rounded-xl transition-transform duration-200 ease-candy group-hover:scale-105 group-hover:-rotate-3"
                    style={{ backgroundColor: flavor.tint }}
                    aria-hidden="true"
                  >
                    <Candy size={30} color={flavor.base} />
                  </span>
                  <div>
                    <div className="font-candy font-bold leading-tight text-xs md:text-sm text-foreground">
                      {cat.name}
                    </div>
                    <div
                      className="mt-1 inline-block px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold"
                      style={{ backgroundColor: flavor.tint, color: flavor.ink }}
                    >
                      {cat.count}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
