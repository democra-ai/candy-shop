import { Search, ShoppingBag, Check, X, Calendar, Heart, Play, Star, Github, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { SKILLS_DATA, SKILL_CATEGORIES, type Skill } from '../../data/skillsData';
import { SkillModal } from '../common/SkillModal';
import { storageUtils } from '../../utils/storage';
import { cn } from '../../utils/cn';
import { toast } from 'sonner';
import { useLanguage } from '../../contexts/LanguageContext';
import { useVersionMode } from '../../contexts/VersionModeContext';
import { useDebounce } from '../../hooks/useDebounce';

interface SkillsGridProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  tagFilter: string | null;
  setTagFilter: (t: string | null) => void;
  cart: Set<string>;
  onToggleCart: (id: string) => void;
  onRunSkill: (skill: Skill) => void;
}

const getCategoryColor = (category: string) => {
  const colors: Record<string, { bg: string; text: string; border: string; solid: string; illustration: string }> = {
    Development: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', solid: 'bg-blue-500', illustration: '/illustrations/development.png' },
    Design: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', solid: 'bg-pink-500', illustration: '/illustrations/design.png' },
    Marketing: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', solid: 'bg-orange-500', illustration: '/illustrations/marketing.png' },
    Productivity: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', solid: 'bg-emerald-500', illustration: '/illustrations/productivity.png' },
    Tools: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', solid: 'bg-violet-500', illustration: '/illustrations/tools.png' },
    Research: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', solid: 'bg-cyan-500', illustration: '/illustrations/research.png' },
    Mobile: { bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-lime-500/20', solid: 'bg-lime-500', illustration: '/illustrations/mobile.png' },
    Writing: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', solid: 'bg-yellow-500', illustration: '/illustrations/writing.png' },
  };
  return colors[category] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20', solid: 'bg-gray-500', illustration: '/illustrations/development.png' };
};

const POPULAR_TAGS = (() => {
  const tagCounts: Record<string, number> = {};
  SKILLS_DATA.forEach(s => s.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag);
})();

export function SkillsGrid({
  searchQuery,
  setSearchQuery,
  tagFilter,
  setTagFilter,
  cart,
  onToggleCart,
  onRunSkill,
}: SkillsGridProps) {
  const { t } = useLanguage();
  const { mode } = useVersionMode();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const isDebouncing = searchQuery !== debouncedSearchQuery;
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [likedSkills, setLikedSkills] = useState<Set<string>>(() => new Set(storageUtils.getLikes()));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 12;
  const [currentPage, setCurrentPage] = useState(0);

  const prevFiltersRef = useRef({ searchQuery: debouncedSearchQuery, tagFilter });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.searchQuery !== debouncedSearchQuery || prev.tagFilter !== tagFilter) {
      setCurrentPage(0);
      prevFiltersRef.current = { searchQuery: debouncedSearchQuery, tagFilter };
    }
  }, [debouncedSearchQuery, tagFilter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLike = (skillId: string) => {
    const isLiked = likedSkills.has(skillId);
    const skillName = SKILLS_DATA.find(s => s.id === skillId)?.name || skillId;
    if (isLiked) {
      storageUtils.removeLike(skillId);
      setLikedSkills((prev) => {
        const next = new Set(prev);
        next.delete(skillId);
        return next;
      });
    } else {
      storageUtils.saveLike(skillId);
      setLikedSkills((prev) => {
        const next = new Set(prev);
        next.add(skillId);
        return next;
      });
      toast.success(`Liked ${skillName}`);
    }
  };

  const filteredSkills = useMemo(() => {
    return SKILLS_DATA
      .filter((skill) => {
        const matchesSearch =
          skill.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          skill.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          skill.tags.some(t => t.toLowerCase().includes(debouncedSearchQuery.toLowerCase()));

        const matchesTag = tagFilter ?
          (skill.tags.includes(tagFilter) || skill.category === tagFilter) : true;

        return matchesSearch && matchesTag;
      })
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }, [debouncedSearchQuery, tagFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSkills.length / ITEMS_PER_PAGE));
  const pageSkills = filteredSkills.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    const clamped = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(clamped);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const lastVisibleCountRef = useRef(pageSkills.length || ITEMS_PER_PAGE);
  if (pageSkills.length > 0) lastVisibleCountRef.current = pageSkills.length;

  const currentPageRef = useRef(currentPage);
  const totalPagesRef = useRef(totalPages);
  currentPageRef.current = currentPage;
  totalPagesRef.current = totalPages;

  useEffect(() => {
    let touchStartX = 0;
    const SWIPE_THRESHOLD = 50;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') goToPage(currentPageRef.current - 1);
      if (e.key === 'ArrowRight') goToPage(currentPageRef.current + 1);
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > SWIPE_THRESHOLD) {
        if (diff > 0) goToPage(currentPageRef.current + 1);
        else goToPage(currentPageRef.current - 1);
      }
    };

    const grid = gridRef.current;
    document.addEventListener('keydown', handleKeyDown);
    grid?.addEventListener('touchstart', handleTouchStart, { passive: true });
    grid?.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      grid?.removeEventListener('touchstart', handleTouchStart);
      grid?.removeEventListener('touchend', handleTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paginationItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
    pages.push(0);
    if (currentPage > 2) pages.push('ellipsis-start');
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages - 2, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 3) pages.push('ellipsis-end');
    pages.push(totalPages - 1);
    const seen = new Set<number | string>();
    return pages.filter(v => {
      const key = typeof v === 'number' ? v : v;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [totalPages, currentPage]);

  return (
    <>
      <section className="py-20 bg-background" id="skills-grid">
        <div className="container max-w-7xl mx-auto px-4">
          {/* Section Header & Search */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl font-candy font-bold mb-2 text-foreground">
                {tagFilter ? t('skills.categoryModules', { category: tagFilter }) : t('skills.freshlyBaked')}
              </h2>
              <div className="flex items-center gap-2 text-foreground-tertiary font-mono text-sm">
                <span>$ ls ./inventory</span>
                {tagFilter && (
                  <button
                    onClick={() => setTagFilter(null)}
                    className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-1"
                  >
                    --filter="{tagFilter}" <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="w-full md:w-96 relative group">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
                <input
                  ref={searchInputRef}
                  id="search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('skills.search')}
                  className={cn(
                    'w-full h-11 pl-11 pr-16 glass border border-border/50 rounded-xl text-sm font-mono',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30',
                    'transition-all placeholder:text-foreground-tertiary',
                    'shadow-warm hover:shadow-warm-lg'
                  )}
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-medium text-foreground-tertiary glass rounded-md border border-border/30">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>

          {/* Skeleton Grid (during debounce) */}
          {isDebouncing && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: lastVisibleCountRef.current }).map((_, i) => (
                <div
                  key={i}
                  className="bg-card/80 rounded-xl border border-border/50 overflow-hidden"
                >
                  <div className="h-10 bg-secondary/30 animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-secondary/30 rounded-lg animate-pulse w-3/4" />
                    <div className="h-3 bg-secondary/30 rounded-lg animate-pulse w-full" />
                    <div className="h-3 bg-secondary/30 rounded-lg animate-pulse w-2/3" />
                    <div className="flex gap-2 pt-2">
                      <div className="h-5 w-16 bg-secondary/30 rounded-full animate-pulse" />
                      <div className="h-5 w-12 bg-secondary/30 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div className="h-10 bg-secondary/20 animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {/* Grid */}
          {!isDebouncing && (
          <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-reveal">
            {pageSkills.map((skill) => (
              <div
                key={skill.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSkill(skill)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedSkill(skill);
                  }
                }}
                aria-label={`View details for ${skill.name}`}
                className={cn(
                  'group bg-card/80 glass rounded-xl border border-border/50',
                  'hover:shadow-card-hover hover:border-primary/20',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                  'transition-all duration-300 flex flex-col h-full overflow-hidden cursor-pointer',
                  'card-luxe gradient-border'
                )}
              >
                {/* === Dev Mode: Code-style card === */}
                {mode === 'dev' && (
                  <>
                    {/* Top Bar */}
                    <div
                      className={cn(
                        'h-10 px-4 border-b border-border/50 flex items-center bg-secondary/30 relative',
                        'group-hover:bg-secondary/50 transition-colors'
                      )}
                    >
                      <div className="flex items-center gap-1.5 absolute left-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                      </div>
                      <div className="mx-auto text-xs font-mono text-foreground-tertiary font-medium">
                        {skill.id}.ts
                      </div>
                    </div>

                    {/* Code Content */}
                    <div className="p-5 flex-1 font-mono text-sm leading-relaxed">
                      <div className="pl-4 border-l-2 border-primary/20 group-hover:border-primary/40 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-syntax-keyword font-bold">export</span>
                          <span className="text-syntax-variable font-bold">
                            {skill.name.replace(/\s+/g, '')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-syntax-keyword">from</span>
                          <span className="text-syntax-string text-xs truncate">
                            "{skill.installCommand.split(' ').pop()}"
                          </span>
                        </div>

                        <p className="text-syntax-comment text-xs mb-3 line-clamp-2 leading-relaxed">
                          // {skill.description}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-3 border-l-2 border-border/50 pl-3">
                          <span className="text-primary/70 text-[10px] uppercase font-bold tracking-tight bg-primary/5 px-2 rounded">// {skill.category}</span>
                          {skill.tags.map(tag => (
                            <span key={tag} className="text-foreground-secondary text-[10px] uppercase font-bold tracking-tight bg-secondary/30 px-2 rounded">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer Status Bar */}
                    <div
                      className={cn(
                        'h-10 px-4 border-t border-border/50 bg-secondary/10 flex items-center justify-between text-xs font-mono text-foreground-tertiary',
                        'group-hover:bg-secondary/20 transition-colors'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>{t('skills.updatedToday')}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRunSkill(skill);
                          }}
                          className="p-2 rounded-lg hover:text-green-600 hover:bg-green-500/10 transition-all duration-200 cursor-pointer btn-press min-w-[32px] min-h-[32px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-500/30"
                          title={t('skills.runSkill')}
                          aria-label={`Run ${skill.name}`}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleLike(skill.id);
                          }}
                          className="p-2 rounded-lg hover:text-pink-500 hover:bg-pink-500/10 transition-all duration-200 cursor-pointer btn-press min-w-[32px] min-h-[32px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-pink-500/30"
                          type="button"
                          aria-label={likedSkills.has(skill.id) ? 'Unlike skill' : 'Like skill'}
                        >
                          <Heart
                            className={cn(
                              'w-3.5 h-3.5 transition-colors pointer-events-none',
                              likedSkills.has(skill.id) ? 'fill-pink-500 text-pink-500' : ''
                            )}
                          />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCart(skill.id);
                          }}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase font-bold tracking-wide transition-all duration-200 border cursor-pointer btn-press min-h-[28px] focus:outline-none focus:ring-2 focus:ring-primary/30',
                            cart.has(skill.id)
                              ? 'bg-green-500/10 border-green-500/20 text-green-600 hover:bg-green-500/20'
                              : 'glass border-border/50 text-foreground-tertiary hover:border-primary/30 hover:text-primary'
                          )}
                          aria-label={cart.has(skill.id) ? t('skills.removeFromBag', { name: skill.name }) : t('skills.addToBag', { name: skill.name })}
                        >
                          {cart.has(skill.id) ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>{t('skills.inBag')}</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3 h-3" />
                              <span>{t('skills.add')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* === User Mode: Image+Text card === */}
                {mode === 'user' && (
                  <>
                    <div className={`relative h-36 overflow-hidden ${getCategoryColor(skill.category).bg} rounded-t-xl`}>
                      <img
                        src={getCategoryColor(skill.category).illustration}
                        alt={skill.category}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                      <div className="absolute bottom-3 left-4 flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl glass backdrop-blur-sm border ${getCategoryColor(skill.category).border} flex items-center justify-center text-xl shadow-warm-lg`}>
                          {skill.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-base leading-tight drop-shadow-sm font-candy">
                            {skill.name}
                          </h3>
                          <span className={`text-xs font-medium ${getCategoryColor(skill.category).text}`}>
                            {skill.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1 text-xs text-foreground-secondary">
                          <Star className="w-3.5 h-3.5 fill-caramel text-caramel" />
                          <span className="font-medium text-caramel">{skill.popularity || 0}</span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${getCategoryColor(skill.category).bg} ${getCategoryColor(skill.category).text}`}>
                          {skill.category}
                        </span>
                      </div>

                      <p className="text-sm text-foreground-secondary mb-4 line-clamp-2 leading-relaxed font-body">
                        {skill.description}
                      </p>

                      {skill.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {skill.tags.map(tag => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium bg-secondary/50 text-foreground-secondary px-2 py-0.5 rounded-full border border-border/30"
                            >
                              #{tag.toLowerCase()}
                            </span>
                          ))}
                        </div>
                      )}

                      <a
                        href={`https://github.com/${skill.repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs text-foreground-tertiary hover:text-primary transition-colors mb-4 group/link"
                      >
                        <Github className="w-3.5 h-3.5" />
                        <span>{skill.repo}</span>
                        <span className="opacity-0 group-hover/link:opacity-100 transition-opacity">→</span>
                      </a>

                      <div className="flex items-center gap-2 mt-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRunSkill(skill);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-primary-foreground text-sm font-body font-semibold shadow-candy hover:shadow-candy-lg transition-all duration-300 btn-press"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          {t('skills.runSkill')}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(skill.id);
                          }}
                          className={cn(
                            "p-2.5 rounded-xl transition-all duration-200 border btn-press",
                            likedSkills.has(skill.id)
                              ? "bg-pink-500/10 text-pink-500 border-pink-500/20"
                              : "glass text-foreground-tertiary border-border/50 hover:text-foreground"
                          )}
                        >
                          <Heart className={cn("w-4 h-4", likedSkills.has(skill.id) ? "fill-current" : "")} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCart(skill.id);
                          }}
                          className={cn(
                            "p-2.5 rounded-xl transition-all duration-200 border btn-press",
                            cart.has(skill.id)
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : "glass text-foreground-tertiary border-border/50 hover:text-foreground"
                          )}
                        >
                          {cart.has(skill.id) ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <ShoppingBag className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          )}

          {/* Pagination Controls */}
          {!isDebouncing && totalPages > 1 && (
            <div className="flex flex-col items-center gap-4 pt-10">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 0}
                  className={cn(
                    'p-2 rounded-full transition-all duration-200 btn-press',
                    currentPage === 0
                      ? 'text-foreground-muted cursor-not-allowed'
                      : 'text-foreground-secondary hover:text-foreground hover:bg-secondary/70 cursor-pointer'
                  )}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <nav className="flex items-center gap-1" aria-label="Pagination">
                  {paginationItems.map((item, idx) => {
                    if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                      return <span key={`e-${idx}`} className="text-foreground-muted text-xs px-1.5">...</span>;
                    }
                    return (
                      <button
                        key={item}
                        onClick={() => goToPage(item)}
                        className={cn(
                          'min-w-[32px] h-8 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer btn-press',
                          item === currentPage
                            ? 'bg-gradient-to-r from-primary to-primary-hover text-primary-foreground shadow-candy font-bold'
                            : 'text-foreground-secondary hover:bg-secondary/70 hover:text-foreground'
                        )}
                        aria-label={`Page ${item + 1}`}
                        aria-current={item === currentPage ? 'page' : undefined}
                      >
                        {item + 1}
                      </button>
                    );
                  })}
                </nav>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages - 1}
                  className={cn(
                    'p-2 rounded-full transition-all duration-200 btn-press',
                    currentPage === totalPages - 1
                      ? 'text-foreground-muted cursor-not-allowed'
                      : 'text-foreground-secondary hover:text-foreground hover:bg-secondary/70 cursor-pointer'
                  )}
                  aria-label="Next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <span className="text-xs text-foreground-tertiary font-mono">
                {currentPage + 1} / {totalPages}
              </span>
            </div>
          )}

          {!isDebouncing && filteredSkills.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mb-6 shadow-warm">
                <Search className="w-8 h-8 text-foreground-tertiary" />
              </div>
              <h3 className="text-lg font-candy font-bold text-foreground mb-2">
                {t('skills.noSkillsTitle')}
              </h3>
              <p className="text-foreground-secondary text-sm font-body max-w-md mb-6">
                {searchQuery
                  ? t('skills.noResultsSearch', { query: searchQuery })
                  : t('skills.noResultsFilter')}
              </p>
              <div className="flex flex-wrap gap-3 justify-center mb-6">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 text-sm font-body font-medium glass text-foreground rounded-xl hover:shadow-warm-lg transition-all btn-press"
                  >
                    {t('skills.clearSearch')}
                  </button>
                )}
                {tagFilter && (
                  <button
                    onClick={() => setTagFilter(null)}
                    className="px-4 py-2 text-sm font-body font-medium bg-gradient-to-r from-primary to-primary-hover text-primary-foreground rounded-xl shadow-candy hover:shadow-candy-lg transition-all btn-press"
                  >
                    {t('skills.showAll')}
                  </button>
                )}
              </div>

              {searchQuery && (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xs text-foreground-tertiary font-mono">{t('skills.trySearching')}</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {POPULAR_TAGS.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setSearchQuery(tag)}
                        className="px-3 py-1 text-xs font-mono glass text-foreground-secondary rounded-full border border-border/30 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all cursor-pointer btn-press"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} onRun={onRunSkill} />
    </>
  );
}
