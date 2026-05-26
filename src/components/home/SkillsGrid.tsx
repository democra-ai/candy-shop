import { Search, ShoppingBag, Check, X, Heart, Play, Star, ChevronLeft, ChevronRight, Plus, Database, ExternalLink, Users, Zap } from 'lucide-react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { SKILLS_DATA, REGISTRY_STATS, type Skill } from '../../data/skillsData';
import { SkillModal } from '../common/SkillModal';
import { LineageBadge, PricingBadge, ExecutionModelBadge } from '../common/LineageBadge';
import { AuditPillCompact, EditorChoiceBadge } from '../common/AuditBadges';
import { storageUtils } from '../../utils/storage';
import { cn } from '../../utils/cn';
import { toast } from 'sonner';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDebounce } from '../../hooks/useDebounce';
import { CANDY_EMOJIS } from '../../utils/candy';
import { listSkills, type CrawlerSkill } from '../../lib/skillCrawlerClient';

interface SkillsGridProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  tagFilter: string | null;
  setTagFilter: (t: string | null) => void;
  cart: Set<string>;
  onToggleCart: (id: string) => void;
  onRunSkill: (skill: Skill) => void;
  onMatchCraving?: (tags: string[]) => void;
  userCandies?: Skill[];
  onPostCandy?: () => void;
  onPostCraving?: () => void;
}

const getCategoryColor = (category: string) => {
  const colors: Record<string, { bg: string; text: string; border: string; solid: string }> = {
    // Candy Atelier confectionery palette — distinct, but every hue is a
    // candy tone that sits beside raspberry/grape/mint.
    Development: { bg: 'bg-sky-500/10', text: 'text-sky-500', border: 'border-sky-500/25', solid: 'bg-sky-500' },        // blueberry soda
    Design: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-500', border: 'border-fuchsia-500/25', solid: 'bg-fuchsia-500' }, // bubblegum
    Marketing: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/25', solid: 'bg-orange-500' },  // tangerine
    Productivity: { bg: 'bg-teal-500/10', text: 'text-teal-500', border: 'border-teal-500/25', solid: 'bg-teal-500' },     // mint
    Tools: { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/25', solid: 'bg-violet-500' },     // grape
    Research: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/25', solid: 'bg-cyan-500' },         // cotton-candy blue
    Mobile: { bg: 'bg-lime-500/10', text: 'text-lime-600', border: 'border-lime-500/25', solid: 'bg-lime-500' },           // sour apple
    Writing: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/25', solid: 'bg-amber-500' },      // caramel
  };
  return colors[category] || { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/25', solid: 'bg-primary' };
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
  onMatchCraving,
  userCandies = [],
  onPostCandy,
  onPostCraving,
}: SkillsGridProps) {
  const { t } = useLanguage();
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

  const allSkills = useMemo(() => [...userCandies, ...SKILLS_DATA], [userCandies]);

  const filteredSkills = useMemo(() => {
    const filtered = allSkills.filter((skill) => {
      const matchesSearch =
        skill.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        skill.tags.some(t => t.toLowerCase().includes(debouncedSearchQuery.toLowerCase()));

      const matchesTag = tagFilter ?
        (skill.tags.includes(tagFilter) || skill.category === tagFilter) : true;

      return matchesSearch && matchesTag;
    });
    // User-posted candies always float to top, then sort by popularity
    return filtered.sort((a, b) => {
      const aUser = a.id.startsWith('user-candy-') ? 1 : 0;
      const bUser = b.id.startsWith('user-candy-') ? 1 : 0;
      if (aUser !== bUser) return bUser - aUser;
      return (b.popularity || 0) - (a.popularity || 0);
    });
  }, [debouncedSearchQuery, tagFilter, allSkills]);

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

            <div className="flex gap-3 items-center w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
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
              {onPostCandy && (
                <button
                  onClick={onPostCandy}
                  className="sticker candy-gloss h-11 px-4 flex items-center gap-2 bg-candy-gradient text-white !rounded-xl font-body font-bold text-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Post Candy
                </button>
              )}
              {onPostCraving && (
                <button
                  onClick={onPostCraving}
                  className="sticker h-11 px-4 flex items-center gap-2 bg-card text-grape !rounded-xl font-body font-bold text-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Post Craving
                </button>
              )}
            </div>
          </div>

          {/* Registry Stats Banner */}
          <div className="mb-8 space-y-3">
            {/* Total stats row */}
            <div className="p-4 glass rounded-xl border border-border/50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center text-xl">
                  📦
                </div>
                <div>
                  <p className="text-sm font-body font-semibold text-foreground">
                    Skills Registry Database
                  </p>
                  <p className="text-xs font-mono text-foreground-tertiary">
                    Community-indexed · Updated {REGISTRY_STATS.lastUpdated}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm font-mono">
                <div className="text-center">
                  <div className="font-bold text-foreground text-lg">{REGISTRY_STATS.totalSkills.toLocaleString()}</div>
                  <div className="text-foreground-tertiary text-[10px]">TOTAL SKILLS</div>
                </div>
                <div className="w-px h-8 bg-border/50" />
                <div className="text-center">
                  <div className="font-bold text-foreground text-lg">{REGISTRY_STATS.totalRepos.toLocaleString()}</div>
                  <div className="text-foreground-tertiary text-[10px]">REPOS</div>
                </div>
                <div className="w-px h-8 bg-border/50" />
                <div className="text-center">
                  <div className="font-bold text-foreground text-lg">{(REGISTRY_STATS.totalInstalls / 1e6).toFixed(1)}M</div>
                  <div className="text-foreground-tertiary text-[10px]">INSTALLS</div>
                </div>
              </div>
            </div>

            {/* Public vs Premium breakdown */}
            <div className="grid grid-cols-2 gap-3">
              {/* Public / Open Source */}
              <div className="p-3.5 glass rounded-xl border border-emerald-500/20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <span className="text-emerald-400 text-lg">🌐</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-base font-mono">{REGISTRY_STATS.publicSkills.toLocaleString()}</span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      FREE
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-foreground-tertiary mt-0.5">Open-source community skills</p>
                </div>
              </div>

              {/* Premium / Paid */}
              <div className="p-3.5 glass rounded-xl border border-amber-500/20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <span className="text-amber-400 text-lg">👑</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-base font-mono">{REGISTRY_STATS.premiumSkills.toLocaleString()}</span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      PREMIUM
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-foreground-tertiary mt-0.5">{REGISTRY_STATS.premiumProviders} verified providers</p>
                </div>
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
            {pageSkills.map((skill, skillIndex) => (
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
                  'sticker candy-gloss group bg-card',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                  'flex flex-col h-full overflow-hidden cursor-pointer'
                )}
              >
                {/* Your Candy badge */}
                {skill.id.startsWith('user-candy-') && (
                      <div className="px-5 pt-3 pb-0">
                        <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-mono">
                          ✦ Your Candy
                        </span>
                      </div>
                    )}
                    {/* Editor's Pick badge */}
                    {skill.editorPick && !skill.id.startsWith('user-candy-') && (
                      <div className="px-5 pt-3 pb-0">
                        <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono flex items-center gap-1 w-fit">
                          ✦ Editor's Pick
                        </span>
                      </div>
                    )}
                    {/* Lineage & Pricing badges */}
                    {(skill.lineage || skill.pricingModel) && !skill.id.startsWith('user-candy-') && (
                      <div className="px-5 pt-2 pb-0 flex flex-wrap items-center gap-1.5">
                        <LineageBadge lineage={skill.lineage} size="xs" />
                        <PricingBadge pricingModel={skill.pricingModel} price={skill.price} size="xs" />
                        <ExecutionModelBadge model={skill.executionModel} size="xs" />
                      </div>
                    )}
                    {/* Card Header */}
                    <div className={cn('p-5', skill.id.startsWith('user-candy-') ? 'pt-2 pb-0' : 'pb-0')}>
                      <div className="flex items-start gap-3.5">
                        <div className={cn(
                          'w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0',
                          'bg-gradient-to-br shadow-sm',
                          getCategoryColor(skill.category).bg,
                          'border', getCategoryColor(skill.category).border
                        )}>
                          <span className="animate-candy-float inline-block" style={{ animationDelay: `${(skillIndex % 5) * 0.3}s` }}>
                            {CANDY_EMOJIS[skillIndex % CANDY_EMOJIS.length]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-foreground text-[15px] leading-snug font-candy truncate">
                            {skill.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={cn('text-[11px] font-medium', getCategoryColor(skill.category).text)}>
                              {skill.category}
                            </span>
                            <span className="text-border">·</span>
                            <div className="flex items-center gap-0.5 text-[11px] text-foreground-tertiary">
                              <Star className="w-3 h-3 fill-caramel text-caramel" />
                              <span>{(() => { const r = skill.rating || (3.5 + (Math.abs([...skill.name].reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0,0)) % 15) / 10); return (Math.round(r * 10) / 10).toFixed(1); })()}</span>
                            </div>
                            <span className="text-border">·</span>
                            <div className="flex items-center gap-0.5 text-[11px] text-foreground-tertiary">
                              <Users className="w-3 h-3" />
                              <span>{skill.popularity ? (skill.popularity >= 10000 ? `${(skill.popularity / 10000).toFixed(1)}w` : skill.popularity >= 1000 ? `${(skill.popularity / 1000).toFixed(1)}k` : skill.popularity) : '—'}</span>
                            </div>
                            {skill.repo && (
                              <>
                                <span className="text-border">·</span>
                                <span className="text-[10px] text-green-500 font-medium">Open Source</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Description & Tags */}
                    <div className="px-5 pt-3 pb-4 flex-1">
                      <p className="text-[13px] text-foreground-secondary line-clamp-2 leading-relaxed font-body">
                        {skill.description}
                      </p>
                      {skill.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {skill.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium bg-secondary/50 text-foreground-tertiary px-2 py-0.5 rounded-full"
                            >
                              #{tag.toLowerCase()}
                            </span>
                          ))}
                          {skill.tags.length > 3 && (
                            <span className="text-[10px] text-foreground-tertiary px-1 py-0.5">
                              +{skill.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Showcases (if editor pick or has showcases) */}
                    {skill.showcases && skill.showcases.length > 0 && (
                      <div className="px-5 pb-3">
                        <div className="flex gap-1.5">
                          {skill.showcases.slice(0, 3).map((sc, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-secondary/40 rounded-lg py-1.5 px-1.5 flex items-center gap-1.5 min-w-0"
                            >
                              <span className="text-sm shrink-0">{sc.emoji || '📋'}</span>
                              <span className="text-[10px] text-foreground-secondary leading-tight truncate">{sc.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="px-5 pb-4 flex items-center gap-2 mt-auto">
                      <button
                        onClick={(e) => { e.stopPropagation(); onRunSkill(skill); }}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-body font-medium transition-all duration-200 btn-press',
                          skill.executionModel === 'managed'
                            ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white'
                            : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
                        )}
                      >
                        {skill.executionModel === 'managed' ? <Zap className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        {skill.executionModel === 'managed' ? 'Invoke' : t('skills.runSkill')}
                      </button>
                      {onMatchCraving && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onMatchCraving(skill.tags); }}
                          className="h-9 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-body font-medium bg-secondary/50 text-foreground-tertiary hover:text-primary hover:bg-primary/10 transition-all duration-200 btn-press whitespace-nowrap"
                          title="Find matching cravings"
                        >
                          😋
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleLike(skill.id); }}
                        className={cn(
                          'h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200 btn-press',
                          likedSkills.has(skill.id)
                            ? 'bg-pink-500/10 text-pink-500'
                            : 'bg-secondary/50 text-foreground-tertiary hover:text-pink-500 hover:bg-pink-500/10'
                        )}
                      >
                        <Heart className={cn('w-3.5 h-3.5', likedSkills.has(skill.id) ? 'fill-current' : '')} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleCart(skill.id); }}
                        className={cn(
                          'h-9 w-9 rounded-lg flex items-center justify-center transition-all duration-200 btn-press',
                          cart.has(skill.id)
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-secondary/50 text-foreground-tertiary hover:text-primary hover:bg-primary/10'
                        )}
                      >
                        {cart.has(skill.id) ? <Check className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                      </button>
                    </div>
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

      {/* ── Full Registry Browser ── */}
      <RegistryBrowser />

      <SkillModal skill={selectedSkill} onClose={() => setSelectedSkill(null)} onRun={onRunSkill} />
    </>
  );
}

// ── Registry Browser Component ──────────────────────────────────────────
const REGISTRY_PAGE_SIZE = 50;

function RegistryBrowser() {
  // API-driven: each page hits skill-crawler /api/skills with offset/limit/q.
  const [items, setItems] = useState<CrawlerSkill[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyEditorsChoice, setOnlyEditorsChoice] = useState(false);
  const debouncedSearch = useDebounce(search, 200);
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (p: number, q: string, ec: boolean) => {
    setLoading(true);
    try {
      const r = await listSkills({
        offset: p * REGISTRY_PAGE_SIZE,
        limit: REGISTRY_PAGE_SIZE,
        q: q || undefined,
        editorsChoice: ec,
        sort: 'stars',
      });
      setItems(r.items);
      // We don't get a total from the API in this version; estimate from
      // page size + whether we got a full page.
      if (r.items.length < REGISTRY_PAGE_SIZE) {
        setTotal(p * REGISTRY_PAGE_SIZE + r.items.length);
      } else {
        // optimistic
        setTotal((prev) => Math.max(prev, (p + 2) * REGISTRY_PAGE_SIZE));
      }
    } catch {
      toast.error('Failed to load registry');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!items) {
      // Optimistically set total from the static stat so the pager renders
      setTotal(REGISTRY_STATS.totalSkills);
      await loadPage(0, '', false);
    }
  }, [expanded, items, loadPage]);

  // Refetch when search / EC filter changes
  useEffect(() => {
    if (!expanded) return;
    setPage(0);
    void loadPage(0, debouncedSearch, onlyEditorsChoice);
  }, [debouncedSearch, onlyEditorsChoice, expanded, loadPage]);

  // Refetch on page change
  useEffect(() => {
    if (!expanded || page === 0) return;
    void loadPage(page, debouncedSearch, onlyEditorsChoice);
  }, [page, expanded, loadPage, debouncedSearch, onlyEditorsChoice]);

  const pageItems = items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / REGISTRY_PAGE_SIZE));

  const goPage = (p: number) => {
    setPage(Math.max(0, Math.min(p, totalPages - 1)));
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const formatStars = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
    return String(n);
  };

  return (
    <section className="py-16 bg-background" id="registry-browser" ref={listRef}>
      <div className="container max-w-7xl mx-auto px-4">
        {/* Expand/Collapse Header */}
        <button
          onClick={handleExpand}
          className="w-full group"
        >
          <div className="flex items-center justify-between p-6 glass rounded-2xl border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-warm-lg">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center border border-violet-500/20">
                <Database className="w-7 h-7 text-violet-400" />
              </div>
              <div className="text-left">
                <h2 className="text-2xl font-candy font-bold text-foreground">
                  Skills Registry Database
                </h2>
                <p className="text-sm font-mono text-foreground-tertiary mt-1">
                  {REGISTRY_STATS.totalSkills.toLocaleString()} skills ({REGISTRY_STATS.publicSkills.toLocaleString()} free + {REGISTRY_STATS.premiumSkills.toLocaleString()} premium) · {REGISTRY_STATS.totalRepos.toLocaleString()} repos
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-mono font-medium border border-violet-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                Updated {REGISTRY_STATS.lastUpdated}
              </span>
              <ChevronRight className={cn(
                'w-5 h-5 text-foreground-tertiary transition-transform duration-300',
                expanded && 'rotate-90'
              )} />
            </div>
          </div>
        </button>

        {/* Expanded Registry Content */}
        {expanded && (
          <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${REGISTRY_STATS.totalSkills.toLocaleString()} skills...`}
                className={cn(
                  'w-full h-12 pl-11 pr-4 glass border border-border/50 rounded-xl text-sm font-mono',
                  'focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30',
                  'transition-all placeholder:text-foreground-tertiary'
                )}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-secondary/70 text-foreground-tertiary"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filters + results */}
            <div className="flex items-center justify-between text-xs font-mono text-foreground-tertiary px-1">
              <div className="flex items-center gap-3">
                <span>
                  {loading ? 'Loading registry...' : `${pageItems.length} on this page · ~${total.toLocaleString()} total`}
                </span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-foreground-secondary">
                  <input
                    type="checkbox"
                    checked={onlyEditorsChoice}
                    onChange={(e) => setOnlyEditorsChoice(e.target.checked)}
                    className="accent-amber-400"
                  />
                  Editor's Choice only
                </label>
              </div>
              {pageItems.length > 0 && (
                <span>Page {page + 1} / {totalPages.toLocaleString()}</span>
              )}
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center animate-pulse">
                  <Database className="w-6 h-6 text-violet-400" />
                </div>
                <p className="text-sm font-mono text-foreground-tertiary">Loading {REGISTRY_STATS.totalSkills.toLocaleString()} skills...</p>
              </div>
            )}

            {/* Skills Table */}
            {!loading && pageItems.length > 0 && (
              <div className="glass rounded-xl border border-border/50 overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[1.4fr_minmax(0,1fr)_auto_auto] gap-4 px-4 py-3 bg-secondary/30 border-b border-border/30 text-[11px] font-mono font-semibold text-foreground-tertiary uppercase tracking-wider">
                  <span>Skill</span>
                  <span className="hidden sm:block">Source / Badges</span>
                  <span className="text-right">Stars</span>
                  <span className="text-right w-16">Action</span>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-border/20">
                  {pageItems.map((it) => {
                    const slug = it.skill_name || it.path.match(/(?:^|\/)([^/]+)\/SKILL\.md$/i)?.[1] || it.repo;
                    const repoSlug = `${it.owner}/${it.repo}`;
                    return (
                      <div
                        key={it.id}
                        className="grid grid-cols-[1.4fr_minmax(0,1fr)_auto_auto] gap-4 px-4 py-3 hover:bg-secondary/20 transition-colors group items-center"
                      >
                        {/* Skill name + description */}
                        <div className="min-w-0">
                          <p className="font-mono text-sm text-foreground truncate font-medium">
                            {slug}
                          </p>
                          <p className="text-[11px] text-foreground-tertiary font-mono truncate sm:hidden">
                            {repoSlug}
                          </p>
                          {it.description && (
                            <p className="hidden sm:block text-[11px] text-foreground-tertiary truncate mt-0.5">
                              {it.description}
                            </p>
                          )}
                        </div>

                        {/* Source + badges */}
                        <div className="hidden sm:flex flex-col gap-1 min-w-0">
                          <a
                            href={it.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-mono text-foreground-tertiary hover:text-violet-400 transition-colors truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate">{repoSlug}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                          <div className="flex flex-wrap items-center gap-1">
                            <EditorChoiceBadge
                              on={it.editors_choice === 1}
                              reason={it.editors_choice_reason}
                              size="xs"
                            />
                            <AuditPillCompact summary={it.audit_summary} size="xs" />
                          </div>
                        </div>

                        {/* Stars */}
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-foreground-secondary">
                            <Star className="w-3 h-3" />
                            {formatStars(it.stars)}
                          </span>
                        </div>

                        {/* Copy install command */}
                        <div className="text-right w-16">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`npx skills add ${repoSlug}/${slug}`);
                              toast.success('Install command copied!');
                            }}
                            className="px-2.5 py-1.5 text-[11px] font-mono font-medium rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all btn-press"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => goPage(0)}
                  disabled={page === 0}
                  className={cn('px-3 py-1.5 text-xs font-mono rounded-lg transition-all btn-press',
                    page === 0 ? 'text-foreground-muted cursor-not-allowed' : 'text-foreground-secondary hover:bg-secondary/70'
                  )}
                >
                  First
                </button>
                <button
                  onClick={() => goPage(page - 1)}
                  disabled={page === 0}
                  className={cn('p-1.5 rounded-lg transition-all btn-press',
                    page === 0 ? 'text-foreground-muted cursor-not-allowed' : 'text-foreground-secondary hover:bg-secondary/70'
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-4 py-1.5 text-xs font-mono font-medium glass rounded-lg border border-border/30">
                  {page + 1} / {totalPages.toLocaleString()}
                </span>

                <button
                  onClick={() => goPage(page + 1)}
                  disabled={page === totalPages - 1}
                  className={cn('p-1.5 rounded-lg transition-all btn-press',
                    page === totalPages - 1 ? 'text-foreground-muted cursor-not-allowed' : 'text-foreground-secondary hover:bg-secondary/70'
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goPage(totalPages - 1)}
                  disabled={page === totalPages - 1}
                  className={cn('px-3 py-1.5 text-xs font-mono rounded-lg transition-all btn-press',
                    page === totalPages - 1 ? 'text-foreground-muted cursor-not-allowed' : 'text-foreground-secondary hover:bg-secondary/70'
                  )}
                >
                  Last
                </button>
              </div>
            )}

            {/* Empty search state */}
            {!loading && pageItems.length === 0 && items !== null && (
              <div className="flex flex-col items-center py-12 gap-3">
                <Search className="w-8 h-8 text-foreground-tertiary" />
                <p className="text-sm font-mono text-foreground-tertiary">
                  {debouncedSearch ? `No skills match "${debouncedSearch}"` : 'No skills'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
