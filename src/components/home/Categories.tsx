import { useMemo } from 'react';
import { SKILLS_DATA, SKILL_CATEGORIES } from '../../data/skillsData';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../utils/cn';

export interface CategoryData {
  name: string;
  icon: string;
  count: number;
  color: string;
}

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
    <section className="py-12 relative" id="categories-section">
      {/* Frosted glass background band */}
      <div className="absolute inset-0 glass" aria-hidden="true" />
      <div className="relative container max-w-7xl mx-auto px-4">
        <div className="flex flex-col items-center text-center mb-10">
          <h2 className="text-3xl font-candy font-bold mb-3 text-foreground tracking-tight">
            {t('categories.title')}
          </h2>
          <p className="text-foreground-secondary font-body max-w-2xl">
            {t('categories.subtitle')}
          </p>
        </div>

        <div className="relative">
          <div className={cn(
            'flex gap-3 pb-2',
            'overflow-x-auto md:overflow-x-visible md:flex-wrap md:justify-center',
            'scrollbar-hide snap-x snap-mandatory',
            '-mx-4 px-4 md:mx-0 md:px-0'
          )}>
            <button
              onClick={() => onSelectCategory(null)}
              className={cn(
                'snap-start shrink-0',
                'px-6 py-2.5 rounded-full text-sm font-body font-semibold transition-all duration-300 border cursor-pointer btn-press',
                isAllActive
                  ? 'bg-gradient-to-r from-primary to-primary-hover text-primary-foreground border-primary/0 shadow-candy animate-jelly'
                  : 'glass text-foreground hover:shadow-warm-lg border-border/50 hover:border-primary/30'
              )}
            >
              {t('categories.allSkills')} ({SKILLS_DATA.length})
            </button>

            {categories.map((cat: CategoryData) => {
              const isActive = activeCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => onSelectCategory(cat.name)}
                  className={cn(
                    'snap-start shrink-0',
                    'group flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-body font-semibold transition-all duration-300 border cursor-pointer btn-press',
                    isActive
                      ? 'bg-gradient-to-r from-primary to-primary-hover text-primary-foreground border-primary/0 shadow-candy animate-jelly'
                      : 'glass text-foreground-secondary hover:text-foreground border-border/50 hover:border-primary/30 hover:shadow-warm-lg'
                  )}
                >
                  <span className={cn('text-lg transition-all', isActive ? 'grayscale-0 scale-110' : 'grayscale group-hover:grayscale-0')}>{cat.icon}</span>
                  <span>{cat.name}</span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full transition-all font-mono',
                    isActive
                      ? 'bg-white/25 text-primary-foreground'
                      : 'bg-secondary/50 text-foreground-tertiary group-hover:bg-primary/10 group-hover:text-primary'
                  )}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Fade indicators for horizontal scroll on mobile */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-background/80 to-transparent md:hidden" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background/80 to-transparent md:hidden" />
        </div>
      </div>
    </section>
  );
}
