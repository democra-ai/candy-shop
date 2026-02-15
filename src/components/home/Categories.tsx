import { useMemo } from 'react';
import { SKILLS_DATA, SKILL_CATEGORIES } from '../../data/skillsData';
import { useLanguage } from '../../contexts/LanguageContext';

export interface CategoryData {
  name: string;
  icon: string;
  count: number;
  color: string;
}

export function Categories({ onSelectCategory }: { onSelectCategory: (category: string) => void }) {
  const { t } = useLanguage();

  const categories = useMemo<CategoryData[]>(() => {
    return SKILL_CATEGORIES.map(cat => ({
      ...cat,
      count: SKILLS_DATA.filter(skill => skill.category === cat.name).length
    })).filter(cat => cat.count > 0);
  }, []);

  return (
    <section className="py-12 bg-background border-b border-border" id="categories-section">
      {/* Refactored UI */}
      <div className="container max-w-7xl mx-auto px-4">
        <div className="flex flex-col items-center text-center mb-10">
          <h2 className="text-3xl font-bold mb-3 text-foreground tracking-tight">
            {t('categories.title')}
          </h2>
          <p className="text-foreground-secondary max-w-2xl">
            Explore our curated collections of AI agent skills specialized for your workflow.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => onSelectCategory('')}
            className="px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 bg-secondary text-foreground hover:bg-secondary-hover border border-border shadow-sm hover:shadow-md cursor-pointer"
          >
            All Skills ({SKILLS_DATA.length})
          </button>

          {categories.map((cat: CategoryData) => (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(cat.name)}
              className="group flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 bg-card text-foreground-secondary hover:text-foreground hover:bg-secondary border border-border hover:border-primary/30 shadow-sm hover:shadow-md cursor-pointer"
            >
              <span className="text-lg grayscale group-hover:grayscale-0 transition-all">{cat.icon}</span>
              <span>{cat.name}</span>
              <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-foreground-tertiary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
