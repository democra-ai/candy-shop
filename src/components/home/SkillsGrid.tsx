import { Search, X, ChevronLeft, ChevronRight, Plus, Database, ExternalLink, Download, Loader2, SlidersHorizontal } from 'lucide-react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { SKILLS_DATA, REGISTRY_STATS, loadFullRegistry, loadFormatRegistry, getLoadedFormatRegistry, FORMAT_REGISTRY_FILES, getFormat, FORMAT_FILTERS, FORMAT_TOTALS, ALL_FORMAT_TOTAL, type Skill, type RegistryEntry, type ItemFormat } from '../../data/skillsData';
import { FacetRail, FacetDrawer } from './FacetRail';
import { useNavigate } from 'react-router-dom';
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

type PriceFilter = 'all' | 'free' | 'paid';

interface SkillsGridProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  tagFilter: string | null;
  setTagFilter: (t: string | null) => void;
  // Format + price filters are LIFTED to HomePage so the desktop rail, the
  // mobile quick-row, and the mobile drawer all read/write ONE source of truth.
  formatFilter: ItemFormat | null;
  setFormatFilter: (f: ItemFormat | null) => void;
  priceFilter: PriceFilter;
  setPriceFilter: (v: PriceFilter) => void;
  cart: Set<string>;
  onToggleCart: (id: string) => void;
  onRunSkill: (skill: Skill) => void;
  onMatchCraving?: (tags: string[]) => void;
  userCandies?: Skill[];
  onPostCandy?: () => void;
  onPostCraving?: () => void;
}

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
  formatFilter,
  setFormatFilter,
  priceFilter,
  setPriceFilter,
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
  // The grid section can sit far down a long page; when the shopper types in the
  // catalog search the result list re-filters and the page height collapses,
  // which used to leave the viewport scrolled into empty space below the
  // results ("where did my results go?"). Pull the search header + grid back
  // into view on the first keystroke of a fresh query so results stay visible
  // as they type. Guarded by a ref so we only scroll on the leading edge (when
  // the box goes from empty → non-empty), never on every character.
  const sectionRef = useRef<HTMLElement>(null);
  const bringResultsIntoView = useCallback(() => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Only scroll if the section header has drifted above the viewport (or is
    // hidden below it) — don't yank the page when results are already on screen.
    if (rect.top < 0 || rect.top > window.innerHeight * 0.5) {
      // Leave room for the global sticky header (h-16 = 64px) plus a little
      // breathing room, so the search box lands just under it, not behind it.
      const HEADER_OFFSET = 72;
      const target = window.scrollY + rect.top - HEADER_OFFSET;
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
  }, []);
  const handleSearchChange = useCallback(
    (value: string) => {
      // Derive "was the box already active" from the live prop (not a local ref)
      // so it never desyncs when a parent clears the query (e.g. on category
      // select). Scroll only on the leading edge: empty → typing.
      const hadQuery = searchQuery.trim().length > 0;
      setSearchQuery(value);
      if (!hadQuery && value.trim().length > 0) bringResultsIntoView();
    },
    [searchQuery, setSearchQuery, bringResultsIntoView],
  );
  const navigate = useNavigate();
  // Format filter (multi-format browse) is now a CONTROLLED prop lifted to
  // HomePage (single source of truth shared by rail + mobile quick-row + drawer).

  // ── Lazy per-format bulk registries ──────────────────────────────
  // Each format's FULL set lives as a static JSON under public/registry/ and is
  // fetched on demand the first time its chip is selected (mirrors the lazy
  // skills registry). `registryItems` merges every already-loaded format's
  // items into the browse catalog; `loadingFormats` drives the inline spinner.
  const [registryItems, setRegistryItems] = useState<Record<string, Skill[]>>({});
  const [loadingFormats, setLoadingFormats] = useState<Set<string>>(() => new Set());

  const ensureFormatLoaded = useCallback((fmt: ItemFormat | null) => {
    if (!fmt) return;
    if (!FORMAT_REGISTRY_FILES[fmt]) return; // no bulk file (e.g. dynamic-worker)
    // already loaded or in flight → nothing to do
    setRegistryItems((prev) => {
      if (prev[fmt]) return prev;
      // kick off the fetch exactly once
      setLoadingFormats((lf) => {
        if (lf.has(fmt)) return lf;
        const next = new Set(lf);
        next.add(fmt);
        return next;
      });
      loadFormatRegistry(fmt)
        .then((items) => {
          setRegistryItems((p) => (p[fmt] ? p : { ...p, [fmt]: items }));
        })
        .finally(() => {
          setLoadingFormats((lf) => {
            if (!lf.has(fmt)) return lf;
            const next = new Set(lf);
            next.delete(fmt);
            return next;
          });
        });
      return prev;
    });
  }, []);

  // Load the selected format's registry when the chip changes.
  useEffect(() => {
    ensureFormatLoaded(formatFilter);
  }, [formatFilter, ensureFormatLoaded]);
  const [likedSkills, setLikedSkills] = useState<Set<string>>(() => new Set(storageUtils.getLikes()));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Infinite scroll: load `PAGE_SIZE` items per sentinel intersection
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  // Refs read by the (stable) IntersectionObserver so it never needs to be
  // torn down/recreated as `visibleCount`/`filteredSkills` change — recreating
  // it on every page was the source of the stalled "loading more" spinner.
  const sentinelInViewRef = useRef(false);
  const totalCountRef = useRef(0);
  const visibleCountRef = useRef(PAGE_SIZE);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearchQuery, tagFilter, formatFilter, priceFilter]);

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

  // Merge user candies + inline seed + every loaded per-format registry.
  // Registries are already deduped against the inline seed in loadFormatRegistry.
  const allSkills = useMemo(() => {
    const loaded = Object.values(registryItems).flat();
    return [...userCandies, ...SKILLS_DATA, ...loaded];
  }, [userCandies, registryItems]);

  const filteredSkills = useMemo(() => {
    const filtered = allSkills.filter((skill) => {
      const matchesSearch =
        skill.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        skill.tags.some(t => t.toLowerCase().includes(debouncedSearchQuery.toLowerCase()));

      const matchesTag = tagFilter ?
        (skill.tags.includes(tagFilter) || skill.category === tagFilter) : true;

      const matchesFormat = formatFilter ? getFormat(skill) === formatFilter : true;

      // Pricing predicate: missing price ⇒ free (the app default).
      const matchesPrice =
        priceFilter === 'free' ? (skill.price ?? 0) === 0
        : priceFilter === 'paid' ? (skill.price ?? 0) > 0
        : true;

      return matchesSearch && matchesTag && matchesFormat && matchesPrice;
    });
    // User-posted candies always float to top, then sort by popularity
    return filtered.sort((a, b) => {
      const aUser = a.id.startsWith('user-candy-') ? 1 : 0;
      const bUser = b.id.startsWith('user-candy-') ? 1 : 0;
      if (aUser !== bUser) return bUser - aUser;
      return (b.popularity || 0) - (a.popularity || 0);
    });
  }, [debouncedSearchQuery, tagFilter, formatFilter, priceFilter, allSkills]);

  // Per-format counts over whatever is CURRENTLY loaded (inline seed + any
  // already-fetched registries). This is correct only for formats whose bulk
  // registry has been loaded; for the rest it under-counts (seed only), which
  // is exactly why the badge falls back to the known stable total below.
  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of allSkills) {
      const f = getFormat(s);
      counts[f] = (counts[f] || 0) + 1;
    }
    return counts;
  }, [allSkills]);

  // Resolve the chip badge text for a format.
  //  • "All" (id === null) → the stable, precomputed grand total. Never sums
  //    `formatCounts` (which would grow as registries stream in → unstable).
  //  • A format with no bulk registry file (dynamic-worker) → its live count
  //    (seed only is the whole truth for it).
  //  • A format whose registry is loaded → the LIVE count (self-corrects any
  //    drift between the precomputed size and the real loaded length).
  //  • A format not yet loaded → the known stable total, so we show the real
  //    number immediately instead of a wrong "0"/"4". If we somehow have no
  //    known total, show "…" rather than a misleading number.
  const formatBadge = useCallback((id: ItemFormat | null): string => {
    if (id === null) return ALL_FORMAT_TOTAL.toLocaleString();
    const hasRegistry = !!FORMAT_REGISTRY_FILES[id];
    const isLoaded = !hasRegistry || !!registryItems[id] || getLoadedFormatRegistry(id) != null;
    if (isLoaded) return (formatCounts[id] ?? 0).toLocaleString();
    const known = FORMAT_TOTALS[id];
    return known != null ? known.toLocaleString() : '…';
  }, [formatCounts, registryItems]);

  // ── Facet coordination ──────────────────────────────────────────
  // How many facets are active (search is NOT a facet, so "Clear filters"
  // never nukes the typed query). Drives the rail/drawer "Clear" affordance,
  // the mobile Filters badge, and the live grid-header result count.
  const activeFacetCount =
    (formatFilter ? 1 : 0) + (tagFilter ? 1 : 0) + (priceFilter !== 'all' ? 1 : 0);
  const anyActive = activeFacetCount > 0;
  const clearAllFacets = useCallback(() => {
    setFormatFilter(null);
    setTagFilter(null);
    setPriceFilter('all');
  }, [setFormatFilter, setTagFilter, setPriceFilter]);

  // Desktop rail accordion open/closed state (FILTER values are the shared
  // lifted props; only this accordion UI is local). Format + Pricing open,
  // Category collapsed (long list).
  const [facetOpen, setFacetOpen] = useState<Record<string, boolean>>({
    format: true,
    price: true,
    category: false,
  });
  const toggleFacet = useCallback(
    (id: string) => setFacetOpen((o) => ({ ...o, [id]: !o[id] })),
    [],
  );

  // Mobile bottom-sheet drawer open state.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Slice the filtered list down to what's currently visible (infinite scroll)
  const visibleSkills = useMemo(
    () => filteredSkills.slice(0, visibleCount),
    [filteredSkills, visibleCount]
  );
  const hasMore = visibleCount < filteredSkills.length;

  // Is the currently-selected format's bulk registry still fetching?
  const isSelectedFormatLoading = formatFilter != null && loadingFormats.has(formatFilter);

  // Skeleton count when debouncing — stable visual mass to avoid layout jumps
  const lastVisibleCountRef = useRef(visibleSkills.length || PAGE_SIZE);
  if (visibleSkills.length > 0) lastVisibleCountRef.current = visibleSkills.length;

  // ── Infinite-scroll sentinel via IntersectionObserver ──
  //
  // Design notes (this used to be the perpetual-spinner bug):
  //  • ONE observer for the component's life. It reads live state from refs
  //    (`visibleCountRef` / `totalCountRef`), so it is never torn down and
  //    rebuilt as the count changes. The old version recreated the observer on
  //    every `visibleCount` change; under that churn the sentinel could stop
  //    re-firing while it was still parked just below a tall masonry column,
  //    leaving the "loading more" spinner spinning forever even though more
  //    items existed locally.
  //  • `pump()` grows `visibleCount` by one page whenever the sentinel is in
  //    view AND there are more local items. It's idempotent and re-callable.
  //  • A companion effect re-runs `pump()` whenever the slice or the catalog
  //    size changes, so we keep filling the viewport (and resume after a
  //    registry lazily streams in) without waiting on a fresh intersection
  //    event — no dead-ends.
  const pumpScheduledRef = useRef(false);
  const pump = useCallback(() => {
    if (pumpScheduledRef.current) return;
    if (!sentinelInViewRef.current) return;
    if (visibleCountRef.current >= totalCountRef.current) return;
    pumpScheduledRef.current = true;
    setIsFetchingMore(true);
    // rAF keeps the "loading" feedback visible for a frame on instant local
    // slices, and lets the DOM settle before we re-measure the sentinel.
    requestAnimationFrame(() => {
      pumpScheduledRef.current = false;
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, totalCountRef.current));
      setIsFetchingMore(false);
    });
  }, []);

  // One persistent observer, kept in a ref. The sentinel is attached via a
  // CALLBACK REF (`setSentinel`) so the observer re-binds every time the
  // sentinel element mounts/unmounts (it unmounts when the list is empty and
  // remounts when results arrive). We also track the live sentinel node so the
  // observer effect can (re)observe it regardless of which ran first — the
  // callback ref fires at commit time, before passive effects, so on the very
  // first mount the observer doesn't exist yet when the ref runs.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelNodeRef = useRef<HTMLDivElement | null>(null);
  const setSentinel = useCallback((node: HTMLDivElement | null) => {
    sentinelNodeRef.current = node;
    const observer = observerRef.current;
    if (!observer) return; // observer effect will observe once it's created
    observer.disconnect();
    sentinelInViewRef.current = false;
    if (node) observer.observe(node);
  }, []);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          sentinelInViewRef.current = entry.isIntersecting;
        }
        pump();
      },
      // 400px rootMargin so we load just before the user reaches the end.
      { rootMargin: '400px 0px', threshold: 0 }
    );
    observerRef.current = observer;
    // Bind whatever sentinel is already mounted (covers first-mount ordering).
    if (sentinelNodeRef.current) observer.observe(sentinelNodeRef.current);
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [pump]);

  // Keep the observer's view of progress fresh and keep filling while the
  // sentinel is parked in view: every time the visible slice grows or the
  // catalog size changes (e.g. a registry lazily streamed in), sync the count
  // refs and try to pump again. This is what turns a "stalled spinner" into
  // either "more loaded" or a clean finite end state — never a dead-end.
  useEffect(() => {
    visibleCountRef.current = visibleCount;
    totalCountRef.current = filteredSkills.length;
    pump();
  }, [visibleCount, filteredSkills.length, pump]);

  // Shared facet props for the desktop rail + mobile drawer. formatBadge is
  // passed DOWN (the only format-count logic, closing over live registry state)
  // — never recomputed in FacetRail.
  const facetProps = {
    formatFilter,
    setFormatFilter,
    priceFilter,
    setPriceFilter,
    tagFilter,
    setTagFilter,
    formatBadge,
    loadingFormats,
    ensureFormatLoaded,
    open: facetOpen,
    toggle: toggleFacet,
  };

  return (
    <>
      <section className="py-12 md:py-16" id="skills-grid" ref={sectionRef}>
        <div className="container max-w-7xl mx-auto px-0">
          {/* In-content 2-col: sticky facet rail (lg+) | masonry grid. The rail
              is `hidden lg:block` and owns its own overflow-y-auto, so this flex
              wrapper adds NO overflow/transform/contain around the grid cell —
              the sticky search header + IntersectionObserver root stay intact.
              The grid cell is a plain in-flow `flex-1 min-w-0` column. */}
          <div className="flex gap-6 lg:gap-8">
            <FacetRail {...facetProps} anyActive={anyActive} onClearAll={clearAllFacets} />
            <div className="flex-1 min-w-0">
          {/* Compact section header: title left, search + CTAs right.
              Sticky so the search box (and the live result count it implies)
              stays pinned to the top of the viewport while the shopper scrolls
              the catalog — results never scroll out from under the input. */}
          <div className="sticky top-16 z-20 mb-8 py-3 bg-background/80 backdrop-blur-md flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="font-candy text-2xl font-bold text-foreground tracking-tight">
                {tagFilter ? t('skills.categoryModules', { category: tagFilter }) : 'All skills'}
              </h2>
              {/* Live composed result count — honest dynamic number, shown only
                  when a facet narrows the catalog (mirrors the end-of-jar marker). */}
              {activeFacetCount > 0 && (
                <span className="tabular-nums text-xs font-mono text-foreground-tertiary whitespace-nowrap">
                  {filteredSkills.length.toLocaleString()} {t('facets.results')}
                </span>
              )}
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
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={bringResultsIntoView}
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
              {/* Mobile Filters trigger — opens the bottom-sheet drawer. The
                  rail is the canonical desktop surface, so this is lg:hidden. */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="h-11 px-4 inline-flex items-center gap-2 bg-card border border-border rounded-xl font-mono text-sm text-foreground-secondary hover:text-foreground hover:border-border-hover transition-colors btn-press lg:hidden"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {t('facets.filters')}
                {activeFacetCount > 0 && (
                  <span className="bg-primary text-primary-foreground rounded-full text-[10px] w-4 h-4 grid place-items-center">
                    {activeFacetCount}
                  </span>
                )}
              </button>
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

          {/* ── Format filter — compact segmented chip row. MOBILE-ONLY quick-row
                (lg:hidden): on desktop the rail's Format group is canonical, but
                on <lg this high-traffic facet stays inline. Same lifted
                formatFilter state → mirror-synced with the rail/drawer. ── */}
          <div className="flex items-center gap-1.5 mb-6 flex-wrap lg:hidden" role="group" aria-label="Filter by format">
            {FORMAT_FILTERS.map((opt) => {
              const active = formatFilter === opt.id;
              const badge = formatBadge(opt.id);
              const isLoading = opt.id != null && loadingFormats.has(opt.id);
              return (
                <button
                  key={opt.id ?? 'all'}
                  onClick={() => setFormatFilter(opt.id)}
                  onMouseEnter={() => ensureFormatLoaded(opt.id)}
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
                  {isLoading ? (
                    <Loader2 className={cn(
                      'w-3 h-3 animate-spin',
                      active ? 'text-primary-foreground/70' : 'text-foreground-tertiary'
                    )} />
                  ) : (
                    <span className={cn(
                      'tabular-nums text-[10px]',
                      active ? 'text-primary-foreground/70' : 'text-foreground-tertiary'
                    )}>
                      {badge}
                    </span>
                  )}
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

          {/* Format registry loading — only when nothing to show yet */}
          {!isDebouncing && isSelectedFormatLoading && filteredSkills.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Loader2 className="w-8 h-8 text-foreground-tertiary animate-spin mb-4" />
              <p className="text-sm font-mono text-foreground-tertiary">
                loading the full {formatFilter} jar…
              </p>
            </div>
          )}

          {/* ── True masonry layout — variable card heights, no gaps ──
                 Editor-pick cards get tall hero shape via CandyCard internals.
                 Infinite scroll: sentinel below the masonry loads more on intersect.
                 Gated on a non-empty result set so a no-match query renders the
                 clean empty state ALONE — never an empty masonry container (which
                 left stray column boxes / pinned cards beneath "no results"). */}
          {!isDebouncing && filteredSkills.length > 0 && (
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
                    onSelect={() => navigate(`/candy/${skill.id}`, { state: { skill } })}
                    onRun={() => onRunSkill(skill)}
                    onLike={() => handleLike(skill.id)}
                    onToggleCart={() => onToggleCart(skill.id)}
                  />
                ))}
              </Masonry>

              {/* Infinite-scroll sentinel — ALWAYS mounted (stable observer
                  target) so the IntersectionObserver never loses its element.
                  Its content switches between the "loading more" spinner and a
                  finite end-of-jar marker, so the grid always resolves to a
                  clear end state and never strands a perpetual spinner. */}
              {filteredSkills.length > 0 && (
                <div
                  ref={setSentinel}
                  className="flex items-center justify-center py-10 text-[11px] font-mono text-foreground-tertiary"
                  aria-live="polite"
                  aria-busy={hasMore && isFetchingMore}
                >
                  {hasMore ? (
                    <span className="inline-flex items-center text-xs">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('skills.loadingMore') || 'loading more candy…'}
                    </span>
                  ) : (
                    <span>— end of jar · {filteredSkills.length.toLocaleString()} candies —</span>
                  )}
                </div>
              )}
            </div>
          )}

          {!isDebouncing && filteredSkills.length === 0 && !isSelectedFormatLoading && (
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
                {priceFilter !== 'all' && (
                  <button
                    onClick={() => setPriceFilter('all')}
                    className="px-4 py-2 text-sm font-body font-medium glass text-foreground rounded-xl hover:shadow-warm-lg transition-all btn-press"
                  >
                    {t('facets.all')} {t('facets.pricing')}
                  </button>
                )}
                {activeFacetCount > 1 && (
                  <button
                    onClick={clearAllFacets}
                    className="px-4 py-2 text-sm font-body font-medium bg-gradient-to-r from-primary to-primary-hover text-primary-foreground rounded-xl shadow-candy hover:shadow-candy-lg transition-all btn-press"
                  >
                    {t('facets.resetAll')}
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
            </div>{/* /flex-1 grid cell */}
          </div>{/* /flex 2-col */}
        </div>

        {/* Mobile facet drawer — bottom sheet, shares the lifted facet state. */}
        <FacetDrawer
          {...facetProps}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          resultCount={filteredSkills.length}
          onClearAll={clearAllFacets}
        />
      </section>

      {/* ── Full Registry Browser ── */}
      <RegistryBrowser />
    </>
  );
}

// ── Registry Browser Component ──────────────────────────────────────────
const REGISTRY_PAGE_SIZE = 50;

function RegistryBrowser() {
  const [registry, setRegistry] = useState<RegistryEntry[] | null>(null);
  // Pre-lowercased "name source" haystack, one string per registry entry,
  // index-aligned with `registry`. Built ONCE when the registry loads so the
  // per-keystroke filter never calls .toLowerCase() across all 88K entries
  // (that was ~176K string allocations on every keystroke → ~2s main-thread
  // block). With the index, filtering is a single .indexOf on already-lowercased
  // strings, which stays responsive even on the full registry.
  const [searchIndex, setSearchIndex] = useState<string[] | null>(null);
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
        // Build the lowercase search index once, at parse time. This is the
        // only place we pay the per-entry .toLowerCase() cost — keystrokes
        // afterwards reuse it.
        const index = new Array<string>(data.length);
        for (let i = 0; i < data.length; i++) {
          const [name, , source] = data[i];
          index[i] = `${name} ${source}`.toLowerCase();
        }
        setRegistry(data);
        setSearchIndex(index);
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
    // Filter against the pre-lowercased index (falls back to per-entry lowercase
    // only if the index somehow isn't ready yet — it always is once registry is).
    if (searchIndex && searchIndex.length === registry.length) {
      const out: RegistryEntry[] = [];
      for (let i = 0; i < registry.length; i++) {
        if (searchIndex[i].indexOf(q) !== -1) out.push(registry[i]);
      }
      return out;
    }
    return registry.filter(([name, , source]) =>
      name.toLowerCase().includes(q) || source.toLowerCase().includes(q)
    );
  }, [registry, searchIndex, debouncedSearch]);

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
