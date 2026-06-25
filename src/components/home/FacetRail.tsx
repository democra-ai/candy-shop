/**
 * FacetRail — the composable left facet rail for the candy catalog.
 *
 * THREE pieces, ONE source of truth:
 *   • FacetGroups  — the shared accordion body (Format / Pricing / Category).
 *                    Rendered VERBATIM by both the desktop rail and the mobile
 *                    drawer so the two can never diverge.
 *   • FacetRail    — desktop `hidden lg:block` sticky <aside>. Owns its OWN
 *                    overflow-y-auto so it never creates a scroll/stacking
 *                    context around the grid's sticky search header or the
 *                    infinite-scroll IntersectionObserver root.
 *   • FacetDrawer  — mobile bottom-sheet (createPortal), backdrop z-40 / sheet
 *                    z-50, Esc to close, focus trap + restore focus, body-scroll
 *                    lock, live "Show N results" footer.
 *
 * COUNTS HONESTY (DESIGN countDisplay rules):
 *   • Format  — formatBadge() precomputed/live totals (passed down, never
 *               recomputed here).
 *   • Pricing — REGISTRY_STATS All/Free/Paid totals (honest at All-scope).
 *   • Category — NO counts (no honest per-category global total exists over the
 *               lazy 88k registry).
 *
 * Tokens only (glass, shadow-candy-1/3, primary one-accent, foreground tiers).
 * The 8 flavor dots are the only hard-coded hex — brand candy colors.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, SlidersHorizontal, X } from 'lucide-react';
import {
  FORMAT_FILTERS,
  SKILL_CATEGORIES,
  REGISTRY_STATS,
  type ItemFormat,
} from '../../data/skillsData';
import { useLanguage } from '../../contexts/LanguageContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { cn } from '../../utils/cn';

type PriceFilter = 'all' | 'free' | 'paid';

export interface FacetGroupsProps {
  formatFilter: ItemFormat | null;
  setFormatFilter: (f: ItemFormat | null) => void;
  priceFilter: PriceFilter;
  setPriceFilter: (v: PriceFilter) => void;
  tagFilter: string | null;
  setTagFilter: (t: string | null) => void;
  /** Passed from SkillsGrid (reuses the existing format-count fn). */
  formatBadge: (id: ItemFormat | null) => string;
  loadingFormats: Set<string>;
  ensureFormatLoaded: (f: ItemFormat | null) => void;
  open: Record<string, boolean>;
  toggle: (id: string) => void;
}

// Brand candy "flavor" dots for the Category rows (the only allowed hex).
const FLAVOR_DOT: Record<string, string> = {
  Development: '#6366f1',
  Design: '#ec4899',
  Marketing: '#f59e0b',
  Productivity: '#10b981',
  Tools: '#8b5cf6',
  Research: '#06b6d4',
  Mobile: '#84cc16',
  Writing: '#eab308',
};

function FacetRow({
  active,
  label,
  count,
  loading,
  dot,
  onClick,
  onWarm,
}: {
  active: boolean;
  label: string;
  count?: string;
  loading?: boolean;
  dot?: string;
  onClick: () => void;
  onWarm?: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      onMouseEnter={onWarm}
      className={cn(
        'group w-full h-9 px-2.5 rounded-xl flex items-center justify-between gap-2 transition-colors duration-200 ease-candy btn-press focus:outline-none focus:ring-2 focus:ring-primary/30',
        active
          ? 'bg-primary/10 border border-primary/15'
          : 'border border-transparent hover:bg-secondary/60',
      )}
    >
      <span className="flex items-center gap-2 min-w-0">
        {dot ? (
          <span
            className="w-3.5 h-3.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: dot,
              boxShadow: active ? '0 0 0 2px var(--color-primary)' : undefined,
            }}
          />
        ) : (
          <span
            className={cn(
              'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 grid place-items-center',
              active ? 'border-primary' : 'border-border',
            )}
          >
            {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </span>
        )}
        <span
          className={cn(
            'truncate text-[13px] font-body',
            active ? 'text-foreground font-semibold' : 'text-foreground-secondary',
          )}
        >
          {label}
        </span>
      </span>
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin text-foreground-tertiary" />
      ) : count != null ? (
        <span
          className={cn(
            'tabular-nums text-[11px] font-mono',
            active ? 'text-primary/70' : 'text-foreground-tertiary',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function FacetGroup({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="py-3 border-t border-border/40 first:border-t-0 first:pt-0">
      <button
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="w-full flex items-center justify-between mb-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 rounded-lg"
      >
        <span className="font-candy text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-foreground-tertiary transition-transform duration-200 ease-candy',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div role="radiogroup" aria-label={title} className="space-y-0.5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The shared accordion body — rendered identically on desktop (rail) and
 * mobile (drawer). All filter values come from props (the lifted state).
 */
export function FacetGroups(p: FacetGroupsProps) {
  const { t } = useLanguage();
  return (
    <>
      {/* FORMAT — honest precomputed/live counts via formatBadge */}
      <FacetGroup id="format" title={t('facets.format')} open={p.open.format} onToggle={p.toggle}>
        {FORMAT_FILTERS.map((o) => (
          <FacetRow
            key={o.id ?? 'all'}
            active={p.formatFilter === o.id}
            label={o.label}
            count={p.formatBadge(o.id)}
            loading={o.id != null && p.loadingFormats.has(o.id)}
            onWarm={() => p.ensureFormatLoaded(o.id)}
            onClick={() => p.setFormatFilter(o.id)}
          />
        ))}
      </FacetGroup>

      {/* PRICING — honest only at All-scope (REGISTRY_STATS totals sum to 88,360) */}
      <FacetGroup id="price" title={t('facets.pricing')} open={p.open.price} onToggle={p.toggle}>
        <FacetRow
          active={p.priceFilter === 'all'}
          label={t('facets.all')}
          count={REGISTRY_STATS.totalSkills.toLocaleString()}
          onClick={() => p.setPriceFilter('all')}
        />
        <FacetRow
          active={p.priceFilter === 'free'}
          label={t('facets.free')}
          count={REGISTRY_STATS.publicSkills.toLocaleString()}
          onClick={() => p.setPriceFilter('free')}
        />
        <FacetRow
          active={p.priceFilter === 'paid'}
          label={t('facets.paid')}
          count={REGISTRY_STATS.premiumSkills.toLocaleString()}
          onClick={() => p.setPriceFilter('paid')}
        />
      </FacetGroup>

      {/* CATEGORY — NO counts (no honest cross-facet global total) */}
      <FacetGroup
        id="category"
        title={t('facets.category')}
        open={p.open.category}
        onToggle={p.toggle}
      >
        <FacetRow active={p.tagFilter == null} label={t('facets.all')} onClick={() => p.setTagFilter(null)} />
        {SKILL_CATEGORIES.map((c) => (
          <FacetRow
            key={c.name}
            active={p.tagFilter === c.name}
            label={c.name}
            dot={FLAVOR_DOT[c.name]}
            onClick={() => p.setTagFilter(c.name)}
          />
        ))}
      </FacetGroup>

      <p className="mt-2 font-mono text-[10px] text-foreground-tertiary">{t('facets.countsNote')}</p>
    </>
  );
}

/**
 * Desktop facet rail — sticky <aside>, hidden below lg. Owns its OWN
 * overflow-y-auto so it never creates a scroll/stacking context around the
 * grid's sticky search header or the infinite-scroll observer root.
 */
export function FacetRail(props: FacetGroupsProps & { anyActive: boolean; onClearAll: () => void }) {
  const { t } = useLanguage();
  return (
    <aside className="hidden lg:block w-60 xl:w-64 flex-shrink-0">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto glass rounded-2xl shadow-candy-1 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-tertiary">
            {t('facets.title')}
          </span>
          {props.anyActive && (
            <button
              onClick={props.onClearAll}
              className="text-[11px] font-mono text-primary hover:underline"
            >
              {t('facets.clear')}
            </button>
          )}
        </div>
        <FacetGroups {...props} />
      </div>
    </aside>
  );
}

/**
 * Mobile facet drawer — bottom sheet via createPortal. Backdrop z-40 / sheet
 * z-50. Esc closes, focus trapped + restored (useFocusTrap), body-scroll
 * locked. The footer shows a LIVE "Show N results" count (state is shared, so
 * results already reflect every tap — the button just closes).
 */
export function FacetDrawer(
  props: FacetGroupsProps & {
    isOpen: boolean;
    onClose: () => void;
    resultCount: number;
    onClearAll: () => void;
  },
) {
  const { t } = useLanguage();
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, props.isOpen);

  // Esc to close + body-scroll lock while open.
  useEffect(() => {
    if (!props.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [props.isOpen, props.onClose]);

  if (!props.isOpen) return null;

  return createPortal(
    <div className="lg:hidden" role="dialog" aria-modal="true" aria-label={t('facets.title')}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm animate-fade-in"
        onClick={props.onClose}
        aria-hidden="true"
      />
      {/* Bottom sheet */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] bg-card rounded-t-3xl shadow-candy-3 flex flex-col"
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mt-3 flex-shrink-0" />
        <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
          <span className="font-candy text-lg font-bold text-foreground inline-flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-foreground-tertiary" />
            {t('facets.title')}
          </span>
          <button
            onClick={props.onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-secondary/70 text-foreground-secondary hover:bg-secondary hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — the SAME FacetGroups as desktop */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <FacetGroups {...props} />
        </div>

        {/* Sticky live-apply footer */}
        <div className="sticky bottom-0 bg-card border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex gap-3 flex-shrink-0">
          <button
            onClick={props.onClearAll}
            className="flex-1 h-11 inline-flex items-center justify-center rounded-xl border border-border text-sm font-body font-medium text-foreground-secondary hover:bg-secondary/60 transition-colors btn-press"
          >
            {t('facets.clearAll')}
          </button>
          <button
            onClick={props.onClose}
            className="flex-1 h-11 inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-body font-semibold shadow-candy-1 btn-press"
          >
            {t('facets.showResults', { count: props.resultCount.toLocaleString() })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
