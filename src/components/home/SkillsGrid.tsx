import { Search, X, ChevronLeft, ChevronRight, Plus, Database, ExternalLink, Download, Loader2 } from 'lucide-react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { SKILLS_DATA, REGISTRY_STATS, loadFullRegistry, getFormat, type Skill, type RegistryEntry, type ItemFormat } from '../../data/skillsData';
import { SkillModal } from '../common/SkillModal';
import { storageUtils } from '../../utils/storage';
import { cn } from '../../utils/cn';
import { toast } from 'sonner';
import { useLanguage } from '../../contexts/LanguageContext';
import { useDebounce } from '../../hooks/useDebounce';
import { CandyCard } from './CandyCard';

// Breakpoint columns config for react-masonry-css.
// Keys are min-widths; values are number of columns.
const MASONRY_BREAKPOINTS = {
  default: 5,
  1280: 5,
  1024: 4,
  768: 3,
  640: 2,
  0: 2,
};

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

// Format filter options for the compact segmented control above the grid.
// `null` = "All". The rest map 1:1 to ItemFormat. Labels stay tight.
const FORMAT_FILTERS: { id: ItemFormat | null; label: string }[] = [
  { id: null, label: 'All' },
  { id: 'claude-skill', label: 'Skills' },
  { id: 'n8n', label: 'n8n' },
  { id: 'dify', label: 'Dify' },
  { id: 'langgraph', label: 'LangGraph' },
  { id: 'dynamic-worker', label: 'Dynamic' },
  { id: 'mcp', label: 'MCP' },
  { id: 'workflow', label: 'Workflows' },
];

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
  onMatchCraving: _onMatchCraving,
  userCandies = [],
  onPostCandy,
  onPostCraving,
}: SkillsGridProps) {
  const { t } = useLanguage();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const isDebouncing = searchQuery !== debouncedSearchQuery;
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  // Format filter (multi-format browse) — null = all formats.
  const [formatFilter, setFormatFilter] = useState<ItemFormat | null>(null);
  const [likedSkills, setLikedSkills] = useState<Set<string>>(() => new Set(storageUtils.getLikes()));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll: load `PAGE_SIZE` items per sentinel intersection
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const fetchInFlightRef = useRef(false);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearchQuery, tagFilter, formatFilter]);

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

      const matchesFormat = formatFilter ? getFormat(skill) === formatFilter : true;

      return matchesSearch && matchesTag && matchesFormat;
    });
    // User-posted candies always float to top, then sort by popularity
    return filtered.sort((a, b) => {
      const aUser = a.id.startsWith('user-candy-') ? 1 : 0;
      const bUser = b.id.startsWith('user-candy-') ? 1 : 0;
      if (aUser !== bUser) return bUser - aUser;
      return (b.popularity || 0) - (a.popularity || 0);
    });
  }, [debouncedSearchQuery, tagFilter, formatFilter, allSkills]);

  // Per-format counts (over the full catalog) for the filter chip badges.
  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of allSkills) {
      const f = getFormat(s);
      counts[f] = (counts[f] || 0) + 1;
    }
    return counts;
  }, [allSkills]);

  // Slice the filtered list down to what's currently visible (infinite scroll)
  const visibleSkills = useMemo(
    () => filteredSkills.slice(0, visibleCount),
    [filteredSkills, visibleCount]
  );
  const hasMore = visibleCount < filteredSkills.length;

  // Skeleton count when debouncing — stable visual mass to avoid layout jumps
  const lastVisibleCountRef = useRef(visibleSkills.length || PAGE_SIZE);
  if (visibleSkills.length > 0) lastVisibleCountRef.current = visibleSkills.length;

  // ── Infinite-scroll sentinel via IntersectionObserver ──
  //
  // When the sentinel div near the bottom of the masonry intersects the viewport
  // (with 400px rootMargin so we load before the user actually hits the end),
  // we extend `visibleCount` by PAGE_SIZE. `fetchInFlightRef` is a synchronous
  // dedup guard so two intersections in the same tick can't double-trigger.
  useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const loadMore = () => {
      if (fetchInFlightRef.current) return;
      if (visibleCount >= filteredSkills.length) return;
      fetchInFlightRef.current = true;
      setIsFetchingMore(true);
      // requestAnimationFrame keeps the visual indicator on-screen briefly
      // so users see "loading" feedback even on instant local slices.
      requestAnimationFrame(() => {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredSkills.length));
        setIsFetchingMore(false);
        fetchInFlightRef.current = false;
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) loadMore();
        }
      },
      { rootMargin: '400px 0px', threshold: 0.01 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visibleCount, filteredSkills.length]);

  return (
    <>
      <section className="py-12 md:py-16" id="skills-grid">
        <div className="container max-w-7xl mx-auto px-0">
          {/* Compact section header: title left, search + CTAs right */}
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="font-candy text-2xl font-bold text-foreground tracking-tight">
                {tagFilter ? t('skills.categoryModules', { category: tagFilter }) : 'All skills'}
              </h2>
              {tagFilter && (
                <button
                  onClick={() => setTagFilter(null)}
                  className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-1 text-xs font-mono"
                >
                  {tagFilter} <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex gap-3 items-center flex-1 md:flex-initial md:w-auto justify-end">
              <div className="relative flex-1 md:w-80 min-w-0">
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
                  className="h-11 px-4 flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl font-body font-semibold text-sm hover:shadow-[0_4px_20px_rgba(244,63,94,0.4)] transition-all duration-200 btn-press whitespace-nowrap shadow-[0_2px_12px_rgba(244,63,94,0.25)]"
                >
                  <Plus className="w-4 h-4" />
                  Post Candy
                </button>
              )}
              {onPostCraving && (
                <button
                  onClick={onPostCraving}
                  className="h-11 px-4 flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-500 rounded-xl font-body font-semibold text-sm hover:bg-blue-500/20 hover:border-blue-500/50 transition-all duration-200 btn-press whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Post Craving
                </button>
              )}
            </div>
          </div>

          {/* ── Format filter — compact segmented chip row. Lets shoppers
                narrow the jar to Claude skills, n8n, Dify, LangGraph, or
                generic workflows. Wired into the same filter memo as
                search + tag. ── */}
          <div className="flex items-center gap-1.5 mb-6 flex-wrap" role="group" aria-label="Filter by format">
            {FORMAT_FILTERS.map((opt) => {
              const active = formatFilter === opt.id;
              const count = opt.id === null
                ? Object.values(formatCounts).reduce((a, b) => a + b, 0)
                : (formatCounts[opt.id] ?? 0);
              return (
                <button
                  key={opt.id ?? 'all'}
                  onClick={() => setFormatFilter(opt.id)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-mono font-medium',
                    'transition-colors duration-200 ease-candy btn-press border',
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-candy-1'
                      : 'bg-card text-foreground-secondary border-border hover:border-border-hover hover:text-foreground'
                  )}
                >
                  {opt.label}
                  <span className={cn(
                    'tabular-nums text-[10px]',
                    active ? 'text-primary-foreground/70' : 'text-foreground-tertiary'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Skeleton — masonry-shaped skeletons during debounce */}
          {isDebouncing && (
            <Masonry
              breakpointCols={MASONRY_BREAKPOINTS}
              className="my-masonry-grid"
              columnClassName="my-masonry-grid_column"
            >
              {Array.from({ length: lastVisibleCountRef.current }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-[24px] bg-secondary/30',
                    // Skeleton has no animate-pulse to avoid flicker on already-busy page
                    i % 3 === 0 ? 'aspect-[4/5]' : i % 3 === 1 ? 'aspect-square' : 'aspect-[5/4]'
                  )}
                />
              ))}
            </Masonry>
          )}

          {/* ── True masonry layout — variable card heights, no gaps ──
                 Editor-pick cards get tall hero shape via CandyCard internals.
                 Infinite scroll: sentinel below the masonry loads more on intersect. */}
          {!isDebouncing && (
            <div ref={gridRef}>
              <Masonry
                breakpointCols={MASONRY_BREAKPOINTS}
                className="my-masonry-grid"
                columnClassName="my-masonry-grid_column"
              >
                {visibleSkills.map((skill, skillIndex) => (
                  <CandyCard
                    key={skill.id}
                    skill={skill}
                    index={skillIndex}
                    isFeatured={!!skill.editorPick}
                    isLiked={likedSkills.has(skill.id)}
                    isInCart={cart.has(skill.id)}
                    onSelect={() => setSelectedSkill(skill)}
                    onRun={() => onRunSkill(skill)}
                    onLike={() => handleLike(skill.id)}
                    onToggleCart={() => onToggleCart(skill.id)}
                  />
                ))}
              </Masonry>

              {/* Infinite-scroll sentinel + loading indicator */}
              {hasMore && (
                <div
                  ref={sentinelRef}
                  className="flex items-center justify-center py-10 text-xs font-mono text-foreground-tertiary"
                  aria-live="polite"
                  aria-busy={isFetchingMore}
                >
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('skills.loadingMore') || 'loading more candy…'}
                </div>
              )}
              {!hasMore && filteredSkills.length > PAGE_SIZE && (
                <div className="text-center py-10 text-[11px] font-mono text-foreground-tertiary">
                  — end of jar · {filteredSkills.length.toLocaleString()} candies —
                </div>
              )}
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
                {formatFilter && (
                  <button
                    onClick={() => setFormatFilter(null)}
                    className="px-4 py-2 text-sm font-body font-medium glass text-foreground rounded-xl hover:shadow-warm-lg transition-all btn-press"
                  >
                    All formats
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
  const [registry, setRegistry] = useState<RegistryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const handleExpand = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!registry) {
      setLoading(true);
      try {
        const data = await loadFullRegistry();
        setRegistry(data);
      } catch {
        toast.error('Failed to load registry');
      } finally {
        setLoading(false);
      }
    }
  }, [expanded, registry]);

  const filtered = useMemo(() => {
    if (!registry) return [];
    if (!debouncedSearch) return registry;
    const q = debouncedSearch.toLowerCase();
    return registry.filter(([name, , source]) =>
      name.toLowerCase().includes(q) || source.toLowerCase().includes(q)
    );
  }, [registry, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / REGISTRY_PAGE_SIZE));
  const pageItems = filtered.slice(page * REGISTRY_PAGE_SIZE, (page + 1) * REGISTRY_PAGE_SIZE);

  useEffect(() => { setPage(0); }, [debouncedSearch]);

  const goPage = (p: number) => {
    setPage(Math.max(0, Math.min(p, totalPages - 1)));
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const formatInstalls = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
    return String(n);
  };

  return (
    <section className="py-16" id="registry-browser" ref={listRef}>
      <div className="container max-w-7xl mx-auto px-4">
        {/* Expand/Collapse Header */}
        <button
          onClick={handleExpand}
          className="w-full group"
        >
          <div className="flex items-center justify-between p-6 bg-secondary rounded-2xl border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-warm-lg">
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

            {/* Results count */}
            <div className="flex items-center justify-between text-xs font-mono text-foreground-tertiary px-1">
              <span>
                {loading ? 'Loading registry...' : `${filtered.length.toLocaleString()} skills found`}
              </span>
              {filtered.length > 0 && (
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
            {!loading && filtered.length > 0 && (
              <div className="glass rounded-xl border border-border/50 overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 py-3 bg-secondary/30 border-b border-border/30 text-[11px] font-mono font-semibold text-foreground-tertiary uppercase tracking-wider">
                  <span>Skill</span>
                  <span className="hidden sm:block">Source</span>
                  <span className="text-right">Installs</span>
                  <span className="text-right w-16">Action</span>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-border/20">
                  {pageItems.map(([name, installs, source], i) => (
                    <div
                      key={`${source}/${name}-${i}`}
                      className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_1fr_auto_auto] gap-4 px-4 py-3 hover:bg-secondary/20 transition-colors group items-center"
                    >
                      {/* Skill name */}
                      <div className="min-w-0">
                        <p className="font-mono text-sm text-foreground truncate font-medium">
                          {name}
                        </p>
                        <p className="text-[11px] text-foreground-tertiary font-mono truncate sm:hidden">
                          {source}
                        </p>
                      </div>

                      {/* Source repo */}
                      <a
                        href={`https://github.com/${source}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-foreground-tertiary hover:text-violet-400 transition-colors truncate min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="truncate">{source}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>

                      {/* Installs */}
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-mono text-foreground-secondary">
                          <Download className="w-3 h-3" />
                          {formatInstalls(installs)}
                        </span>
                      </div>

                      {/* Install button */}
                      <div className="text-right w-16">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`npx skills add ${source}/${name}`);
                            toast.success('Install command copied!');
                          }}
                          className="px-2.5 py-1.5 text-[11px] font-mono font-medium rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all btn-press"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  ))}
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
            {!loading && filtered.length === 0 && registry && (
              <div className="flex flex-col items-center py-12 gap-3">
                <Search className="w-8 h-8 text-foreground-tertiary" />
                <p className="text-sm font-mono text-foreground-tertiary">
                  No skills match "{search}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
