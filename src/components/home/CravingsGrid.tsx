import { Search, Clock, DollarSign, Tag, Zap, ChevronLeft, ChevronRight, Plus, Flame } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { CRAVINGS_DATA, type Craving, type CravingUrgency } from '../../data/cravingsData';
import { cn } from '../../utils/cn';
import { useDebounce } from '../../hooks/useDebounce';

interface CravingsGridProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  tagFilter: string | null;
  setTagFilter: (t: string | null) => void;
  onMatchCandy?: (tags: string[]) => void;
  onPostCraving?: () => void;
  onPostCandy?: () => void;
  userCravings?: Craving[];
}

const URGENCY_CONFIG: Record<CravingUrgency, { label: string; color: string; bg: string; Icon: LucideIcon }> = {
  high: {
    label: 'Urgent',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    Icon: Flame,
  },
  medium: {
    label: 'Normal',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    Icon: Zap,
  },
  low: {
    label: 'Flexible',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    Icon: Clock,
  },
};

const STATUS_CONFIG = {
  open: { label: 'Open', dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-400' },
  'in-progress': { label: 'In Progress', dot: 'bg-amber-400', text: 'text-amber-400' },
  fulfilled: { label: 'Fulfilled', dot: 'bg-gray-400', text: 'text-gray-400' },
};

const CATEGORY_COLORS: Record<string, string> = {
  Development: 'text-blue-400',
  Design: 'text-pink-400',
  Marketing: 'text-orange-400',
  Productivity: 'text-emerald-400',
  Tools: 'text-violet-400',
  Research: 'text-cyan-400',
  Mobile: 'text-lime-400',
  Writing: 'text-yellow-400',
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

const ITEMS_PER_PAGE = 9;

export function CravingsGrid({
  searchQuery,
  setSearchQuery,
  tagFilter,
  setTagFilter,
  onMatchCandy,
  onPostCraving,
  onPostCandy,
  userCravings = [],
}: CravingsGridProps) {
  const debouncedQuery = useDebounce(searchQuery, 300);
  const isDebouncing = searchQuery !== debouncedQuery;
  const [currentPage, setCurrentPage] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const prevFiltersRef = useRef({ searchQuery: debouncedQuery, tagFilter });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (prev.searchQuery !== debouncedQuery || prev.tagFilter !== tagFilter) {
      setCurrentPage(0);
      prevFiltersRef.current = { searchQuery: debouncedQuery, tagFilter };
    }
  }, [debouncedQuery, tagFilter]);

  const allCravings = useMemo(() => [...userCravings, ...CRAVINGS_DATA], [userCravings]);

  const filtered = useMemo(() => {
    return allCravings.filter((c) => {
      const q = debouncedQuery.toLowerCase();
      const matchesSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q);
      const matchesTag = !tagFilter || c.tags.includes(tagFilter) || c.category === tagFilter;
      return matchesSearch && matchesTag;
    });
  }, [debouncedQuery, tagFilter, allCravings]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pageCravings = filtered.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    const clamped = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(clamped);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Collect popular tags from cravings
  const popularTags = useMemo(() => {
    const counts: Record<string, number> = {};
    CRAVINGS_DATA.forEach((c) => c.tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag]) => tag);
  }, []);

  return (
    <section className="py-20 bg-background" id="cravings-grid">
      <div className="container max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="text-3xl font-candy font-bold mb-2 text-foreground">
              {tagFilter ? `Cravings: ${tagFilter}` : 'Fresh Cravings'}
            </h2>
            <div className="flex items-center gap-2 text-foreground-tertiary font-mono text-sm">
              <span>$ ls ./requests</span>
              {tagFilter && (
                <button
                  onClick={() => setTagFilter(null)}
                  className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors flex items-center gap-1 text-xs"
                >
                  --filter="{tagFilter}" ×
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-3 items-center w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-tertiary" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cravings..."
                className={cn(
                  'w-full h-11 pl-11 pr-4 glass border border-border/50 rounded-xl text-sm font-mono',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30',
                  'transition-all placeholder:text-foreground-tertiary',
                  'shadow-warm hover:shadow-warm-lg'
                )}
              />
            </div>

            {/* Post CTAs — both always available */}
            {onPostCandy && (
              <button
                onClick={onPostCandy}
                className="h-11 px-4 flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-xl font-body font-semibold text-sm hover:bg-rose-500/20 hover:border-rose-500/50 transition-all duration-200 btn-press whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Post Candy
              </button>
            )}
            {onPostCraving && (
              <button
                onClick={onPostCraving}
                className="h-11 px-4 flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-body font-semibold text-sm hover:shadow-[0_4px_20px_rgba(59,130,246,0.4)] transition-all duration-200 btn-press whitespace-nowrap shadow-[0_2px_12px_rgba(59,130,246,0.25)]"
              >
                <Plus className="w-4 h-4" />
                Post Craving
              </button>
            )}
          </div>
        </div>

        {/* Skeleton */}
        {isDebouncing && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card/80 rounded-xl border border-border/50 overflow-hidden">
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-secondary/30 rounded-lg animate-pulse w-3/4" />
                  <div className="h-4 bg-secondary/30 rounded-lg animate-pulse w-full" />
                  <div className="h-4 bg-secondary/30 rounded-lg animate-pulse w-5/6" />
                  <div className="flex gap-2 pt-2">
                    <div className="h-5 w-16 bg-secondary/30 rounded-full animate-pulse" />
                    <div className="h-5 w-12 bg-secondary/30 rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="h-12 bg-secondary/20 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        {!isDebouncing && pageCravings.length > 0 && (
          <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-reveal">
            {pageCravings.map((craving) => (
              <CravingCard
                key={craving.id}
                craving={craving}
                isUserPosted={craving.postedBy === 'You'}
                onMatchCandy={onMatchCandy}
                onTagClick={(tag) => { setTagFilter(tag); setSearchQuery(''); }}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isDebouncing && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mb-6 shadow-warm text-4xl">
              😋
            </div>
            <h3 className="text-lg font-candy font-bold text-foreground mb-2">No cravings found</h3>
            <p className="text-foreground-secondary text-sm font-body max-w-md mb-6">
              {searchQuery
                ? `No cravings match "${searchQuery}". Try a different search.`
                : `No cravings in this category yet.`}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 text-sm font-body font-medium glass text-foreground rounded-xl hover:shadow-warm-lg transition-all btn-press"
                >
                  Clear search
                </button>
              )}
              {tagFilter && (
                <button
                  onClick={() => setTagFilter(null)}
                  className="px-4 py-2 text-sm font-body font-medium bg-gradient-to-r from-primary to-primary-hover text-primary-foreground rounded-xl shadow-candy hover:shadow-candy-lg transition-all btn-press"
                >
                  Show all cravings
                </button>
              )}
            </div>

            {searchQuery && (
              <div className="flex flex-col items-center gap-3 mt-6">
                <p className="text-xs text-foreground-tertiary font-mono">Try searching for:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {popularTags.map((tag) => (
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

        {/* Pagination */}
        {!isDebouncing && totalPages > 1 && (
          <div className="flex flex-col items-center gap-4 pt-10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 0}
                className={cn(
                  'p-2 rounded-full transition-all duration-200 btn-press',
                  currentPage === 0 ? 'text-foreground-muted cursor-not-allowed' : 'text-foreground-secondary hover:text-foreground hover:bg-secondary/70 cursor-pointer'
                )}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => goToPage(i)}
                  className={cn(
                    'min-w-[32px] h-8 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer btn-press',
                    i === currentPage
                      ? 'bg-gradient-to-r from-primary to-primary-hover text-primary-foreground shadow-candy font-bold'
                      : 'text-foreground-secondary hover:bg-secondary/70 hover:text-foreground'
                  )}
                >
                  {i + 1}
                </button>
              ))}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className={cn(
                  'p-2 rounded-full transition-all duration-200 btn-press',
                  currentPage === totalPages - 1 ? 'text-foreground-muted cursor-not-allowed' : 'text-foreground-secondary hover:text-foreground hover:bg-secondary/70 cursor-pointer'
                )}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <span className="text-xs text-foreground-tertiary font-mono">
              {currentPage + 1} / {totalPages}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function CravingCard({
  craving,
  isUserPosted,
  onMatchCandy,
  onTagClick,
}: {
  craving: Craving;
  isUserPosted?: boolean;
  onMatchCandy?: (tags: string[]) => void;
  onTagClick: (tag: string) => void;
}) {
  const urgency = URGENCY_CONFIG[craving.urgency];
  const status = STATUS_CONFIG[craving.status];
  const catColor = CATEGORY_COLORS[craving.category] || 'text-foreground-secondary';

  return (
    <div
      className={cn(
        'group bg-card/80 glass rounded-xl border',
        isUserPosted ? 'border-primary/30 ring-1 ring-primary/10' : 'border-border/50',
        'hover:shadow-card-hover hover:border-primary/20',
        'transition-all duration-300 flex flex-col h-full overflow-hidden',
        'card-luxe gradient-border'
      )}
    >
      {/* Your Post Banner */}
      {isUserPosted && (
        <div className="px-5 pt-3 pb-0 flex items-center gap-1.5">
          <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-mono">
            ✦ Your Post
          </span>
        </div>
      )}

      {/* Card Top Bar */}
      <div className={cn('px-5 pb-3', isUserPosted ? 'pt-2' : 'pt-5')}>
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Emoji + Status */}
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-candy-float" style={{ animationDelay: '0.3s' }}>
              {craving.emoji}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
              <span className={cn('text-[11px] font-mono', status.text)}>{status.label}</span>
            </div>
          </div>

          {/* Urgency Badge */}
          <span
            className={cn(
              'flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border',
              urgency.color,
              urgency.bg
            )}
          >
            <urgency.Icon className="w-3 h-3" />
            {urgency.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-foreground text-[15px] leading-snug font-candy line-clamp-2 mb-1">
          {craving.title}
        </h3>

        {/* Category */}
        <span className={cn('text-[11px] font-medium', catColor)}>{craving.category}</span>
      </div>

      {/* Description */}
      <div className="px-5 pb-3 flex-1">
        <p className="text-[13px] text-foreground-secondary line-clamp-3 leading-relaxed font-body">
          {craving.description}
        </p>
      </div>

      {/* Tags */}
      <div className="px-5 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {craving.tags.slice(0, 3).map((tag) => (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              className="text-[10px] font-medium bg-secondary/50 text-foreground-tertiary px-2 py-0.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
            >
              #{tag.toLowerCase()}
            </button>
          ))}
          {craving.tags.length > 3 && (
            <span className="text-[10px] text-foreground-tertiary px-1 py-0.5">+{craving.tags.length - 3}</span>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="px-5 pb-4 flex items-center gap-3 text-[11px] text-foreground-tertiary font-mono">
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          {craving.budget}
        </span>
        <span className="text-border">·</span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(craving.postedAt)}
        </span>
        <span className="text-border">·</span>
        <span>by {craving.postedBy}</span>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 pt-1 border-t border-border/30 mt-auto flex items-center gap-2">
        {onMatchCandy && (
          <button
            onClick={() => onMatchCandy(craving.tags)}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-lg bg-primary/10 text-primary text-sm font-body font-medium hover:bg-primary hover:text-primary-foreground transition-all duration-200 btn-press"
          >
            <Tag className="w-3.5 h-3.5" />
            Find Matching Candy
          </button>
        )}
        <span className="text-[11px] font-mono text-foreground-tertiary flex items-center gap-1 whitespace-nowrap">
          <span className="text-primary font-bold">{craving.matchCount}</span> matches
        </span>
      </div>
    </div>
  );
}
