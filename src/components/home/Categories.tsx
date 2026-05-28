import { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { SKILLS_DATA, SKILL_CATEGORIES, REGISTRY_STATS } from '../../data/skillsData';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../utils/cn';
import { useIsDark } from '../../hooks/useIsDark';
import { getFlavor } from '../../utils/candyShells';

export interface CategoryData {
  name: string;
  icon: string;
  count: number;
  color: string;
}

/**
 * "Browse by flavor" selector (DESIGN.md v2). A refined horizontal row of
 * flavor tiles (pattern borrowed from Figma Community / Vercel template
 * filters): each tile is a soft per-flavor tint well with a consistent-size
 * candy emoji in a card chip, the name in font-candy, and a mono count badge.
 * A flavor accent bar on the left reads the selection; the active tile gets a
 * flavor ring + filled bar. Functional filter — clicking sets the category.
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
    <section className="py-8 md:py-12 relative" id="categories-section">
      <div className="relative container max-w-7xl mx-auto px-0">
        {/* header */}
        <div className="flex items-end justify-between gap-4 mb-5 md:mb-6">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.16em] text-violet-500/90">
              browse by flavor
            </span>
            <h2 className="text-2xl md:text-3xl font-candy font-bold text-foreground tracking-tight leading-none">
              {t('categories.title') || 'Skill directories'}
            </h2>
          </div>
          <p className="text-foreground-tertiary font-mono text-[11px] uppercase tracking-widest hidden md:block">
            {SKILL_CATEGORIES.length} flavors
          </p>
        </div>

        {/* flavor tile row — wraps on small screens */}
        <div className="flex flex-wrap gap-2.5 md:gap-3">
          {/* ALL tile — brand-raspberry accent + grid glyph */}
          <button
            onClick={() => onSelectCategory(null)}
            aria-pressed={isAllActive}
            className={cn(
              'group relative overflow-hidden flex items-center gap-3 text-left',
              'rounded-2xl pl-3.5 pr-4 py-3 border',
              'shadow-candy-1 dark:shadow-candy-1-dark',
              'hover:-translate-y-0.5 hover:shadow-candy-2 dark:hover:shadow-candy-2-dark',
              'transition-[transform,box-shadow,border-color] duration-200 ease-candy cursor-pointer',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-rose-300',
              isAllActive
                ? 'border-rose-400 ring-2 ring-offset-2 ring-offset-background ring-rose-400'
                : 'border-border bg-card hover:border-rose-300',
            )}
            style={isAllActive ? { backgroundColor: isDark ? '#3A2030' : '#FDE6EE' } : undefined}
          >
            {/* left accent bar */}
            <span
              className={cn(
                'absolute left-0 inset-y-0 w-1 rounded-r bg-rose-500 transition-opacity',
                isAllActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-transform duration-200 ease-candy group-hover:scale-105',
                isAllActive ? 'bg-card' : 'bg-secondary',
              )}
            >
              <LayoutGrid className="w-[18px] h-[18px] text-rose-500" />
            </span>
            <span className="flex flex-col min-w-0">
              <span className="font-candy font-bold text-sm leading-tight text-foreground">
                All flavors
              </span>
              <span className="font-mono text-[11px] font-bold leading-tight text-rose-500">
                {REGISTRY_STATS.totalSkills.toLocaleString()}
              </span>
            </span>
          </button>

          {categories.map((cat) => {
            const flavor = getFlavor(cat.name, isDark);
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => onSelectCategory(cat.name)}
                aria-pressed={isActive}
                className={cn(
                  'group relative overflow-hidden flex items-center gap-3 text-left',
                  'rounded-2xl pl-3.5 pr-4 py-3 border',
                  'shadow-candy-1 dark:shadow-candy-1-dark',
                  'hover:-translate-y-0.5 hover:shadow-candy-2 dark:hover:shadow-candy-2-dark',
                  'transition-[transform,box-shadow,border-color] duration-200 ease-candy cursor-pointer',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  flavor.ring,
                  isActive ? 'ring-2 ring-offset-2 ring-offset-background' : 'bg-card border-border',
                )}
                style={isActive
                  ? { backgroundColor: flavor.tint, borderColor: flavor.base, ['--tw-ring-color' as string]: flavor.base }
                  : undefined}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = flavor.base; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = ''; }}
              >
                {/* left flavor accent bar */}
                <span
                  className={cn(
                    'absolute left-0 inset-y-0 w-1 rounded-r transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  )}
                  style={{ backgroundColor: flavor.base }}
                  aria-hidden="true"
                />
                {/* candy emoji — consistent size, in a tinted/card well */}
                <span
                  className="flex items-center justify-center w-10 h-10 rounded-xl text-[22px] leading-none shrink-0 transition-transform duration-200 ease-candy group-hover:scale-105 group-hover:-rotate-3"
                  style={{ backgroundColor: isActive ? 'var(--color-card)' : flavor.tint }}
                  aria-hidden="true"
                >
                  {cat.icon}
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="font-candy font-bold text-sm leading-tight text-foreground whitespace-nowrap">
                    {cat.name}
                  </span>
                  <span
                    className="font-mono text-[11px] font-bold leading-tight"
                    style={{ color: flavor.ink }}
                  >
                    {cat.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
