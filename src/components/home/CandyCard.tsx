/**
 * CandyCard — dense product tile for the candy jar (DESIGN.md v2 §2).
 *
 * The calibrated way: the card is a CLEAN canvas (`bg-card`). Color is carried
 * by the custom SVG candy ILLUSTRATION sitting in a soft flavor "well", plus a
 * thin flavor top-accent and a flavor `tint`/`ink` category chip — never a
 * saturated full-card fill.
 *
 * Composition:
 *   Top accent  : 3px flavor bar across the card top (hover-brightens)
 *   Top row     : illustration well · category chip · pick/paid/hosted badge
 *   Title       : 2 lines max, line-clamp-2 with ellipsis, Fredoka
 *   Description : 2 lines line-clamp, secondary text
 *   Tags        : #tag #tag #tag — first 3 tags, mono (optional)
 *   Meta        : @author · ★ rating · installs (single mono row)
 *   Action      : single RUN pill bottom-right (flavor base)
 *
 * Elevation: resting shadow-candy-1, hover shadow-candy-2 + -translate-y-1 with
 * ease-candy + a flavor-base border. Light + dark both read premium via getFlavor.
 *
 * Like / cart actions live inside the SkillModal (open on click), not the card.
 * Props are STABLE — callers (SkillsGrid, ShopWindow, MostPopularRail, detail
 * pages, modal) pass the same shape.
 */

import { Star, Play, Sparkles, Zap, Users } from 'lucide-react';
import type { Skill } from '../../data/skillsData';
import { cn } from '../../utils/cn';
import { useIsDark } from '../../hooks/useIsDark';
import { getFlavor } from '../../utils/candyShells';
import { getCandyIcon } from '../illustrations';

interface CandyCardProps {
  skill: Skill;
  index: number;
  isFeatured?: boolean;
  /** Retained for prop compatibility with parents that still pass it;
   *  card no longer renders like/cart UI — those live in SkillModal. */
  isLiked?: boolean;
  isInCart?: boolean;
  onSelect: () => void;
  onRun: () => void;
  onLike?: () => void;
  onToggleCart?: () => void;
}

function formatInstalls(n: number | undefined): string {
  if (!n || n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function deriveRating(skill: Skill): number {
  if (skill.rating) return skill.rating;
  const hash = [...skill.name].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  return 3.8 + (Math.abs(hash) % 13) / 10;
}

function fallbackDescription(skill: Skill): string {
  // If skill has no description, weave something readable from category + author
  const author = skill.developer ?? skill.repo?.split('/')[0];
  if (author) return `An AI skill by @${author} — ${skill.category.toLowerCase()} flavour.`;
  return `A ${skill.category.toLowerCase()} skill from the community jar.`;
}

export function CandyCard({
  skill,
  isFeatured = false,
  onSelect,
  onRun,
}: CandyCardProps) {
  const isDark = useIsDark();
  const flavor = getFlavor(skill.category, isDark);
  const rating = deriveRating(skill);
  const Candy = getCandyIcon(skill.category, isDark);
  const isUserCandy = skill.id.startsWith('user-candy-');
  const isManaged = skill.executionModel === 'managed';
  const isPaid = skill.price !== undefined && skill.price > 0;

  const authorHandle = skill.developer ?? skill.repo?.split('/')[0];
  const description = (skill.description && skill.description.length > 8)
    ? skill.description
    : fallbackDescription(skill);
  const visibleTags = (skill.tags ?? []).filter((t) => t && t.length > 0).slice(0, 3);

  // ── Badge logic: ONE category chip + ONE optional status badge
  let statusBadge: { label: string; icon?: typeof Sparkles; tone: 'solid' | 'ghost' } | null = null;
  if (isUserCandy)           statusBadge = { label: 'yours',  icon: Sparkles, tone: 'solid' };
  else if (skill.editorPick) statusBadge = { label: 'pick',   icon: Sparkles, tone: 'solid' };
  else if (isPaid)           statusBadge = { label: `$${(skill.price! / 100).toFixed(0)}`, tone: 'solid' };
  else if (isManaged)        statusBadge = { label: 'hosted', icon: Zap,      tone: 'ghost' };

  const iconBox = isFeatured ? 'w-14 h-14' : 'w-12 h-12';
  const iconSize = isFeatured ? 34 : 28;

  return (
    <article
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${skill.name}`}
      className={cn(
        'group relative w-full cursor-pointer overflow-hidden',
        'rounded-2xl bg-card',
        'border border-border',
        isDark ? 'shadow-candy-1-dark hover:shadow-candy-2-dark' : 'shadow-candy-1 hover:shadow-candy-2',
        'hover:-translate-y-1 transition-[transform,box-shadow,border-color] duration-300 ease-candy',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        flavor.ring,
      )}
      style={{
        // Hover border shifts to the flavor base (set via CSS var so :hover can use it).
        ['--flavor' as string]: flavor.base,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = flavor.base; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
    >
      {/* Thin flavor top-accent — the only saturated edge; brightens on hover */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] opacity-80 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: flavor.base }}
        aria-hidden="true"
      />

      <div
        className={cn(
          'flex flex-col gap-2.5',
          isFeatured ? 'p-5 md:p-6 pt-5 md:pt-6' : 'p-4 md:p-[18px]'
        )}
      >
        {/* ── Top row: illustration well · category chip · status badge ── */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'flex items-center justify-center rounded-xl shrink-0',
              'transition-transform duration-300 ease-candy group-hover:scale-105',
              iconBox
            )}
            style={{ backgroundColor: flavor.tint }}
            aria-hidden="true"
          >
            <Candy size={iconSize} color={flavor.base} />
          </div>
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-widest truncate max-w-full"
              style={{ backgroundColor: flavor.tint, color: flavor.ink }}
            >
              {skill.category}
            </span>
            {statusBadge && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest"
                style={
                  statusBadge.tone === 'solid'
                    ? { backgroundColor: flavor.base, color: '#fff' }
                    : { backgroundColor: flavor.tint, color: flavor.ink }
                }
              >
                {statusBadge.icon && <statusBadge.icon className="w-2.5 h-2.5" />}
                {statusBadge.label}
              </span>
            )}
          </div>
        </div>

        {/* ── Title: 2 lines max, line-clamp-2 with ellipsis ── */}
        <h3
          className={cn(
            'font-candy font-semibold leading-[1.15] line-clamp-2 text-foreground',
            isFeatured ? 'text-xl md:text-2xl' : 'text-base md:text-[17px]'
          )}
          title={skill.name}
        >
          {skill.name}
        </h3>

        {/* ── Description: 2 lines line-clamp ── */}
        <p
          className={cn(
            'font-body line-clamp-2 leading-snug text-foreground-secondary',
            isFeatured ? 'text-sm' : 'text-xs md:text-[13px]'
          )}
        >
          {description}
        </p>

        {/* ── Tags row (optional) ── */}
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] md:text-[11px] font-mono leading-tight min-w-0 text-foreground-tertiary">
            {visibleTags.map((tag) => (
              <span key={tag} className="truncate max-w-[110px]">#{tag.toLowerCase()}</span>
            ))}
          </div>
        )}

        {/* ── Meta + action row ── */}
        <div className="flex items-center justify-between gap-2 pt-1 mt-auto">
          <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] font-mono min-w-0 flex-1 text-foreground-tertiary">
            {authorHandle && (
              <>
                <span className="truncate max-w-[88px]">@{authorHandle}</span>
                <span aria-hidden className="opacity-50">·</span>
              </>
            )}
            <span className="flex items-center gap-0.5 shrink-0" style={{ color: flavor.ink }}>
              <Star className="w-2.5 h-2.5 fill-current" />
              <span className="font-bold">{rating.toFixed(1)}</span>
            </span>
            <span aria-hidden className="opacity-50">·</span>
            <span className="flex items-center gap-0.5 shrink-0">
              <Users className="w-2.5 h-2.5" />
              {formatInstalls(skill.popularity)}
            </span>
          </div>

          {/* Action — single RUN pill in the flavor base. Like / cart live in SkillModal. */}
          <button
            onClick={(e) => { e.stopPropagation(); onRun(); }}
            className="inline-flex items-center justify-center gap-1 h-7 px-3 rounded-full text-[10px] font-body font-bold uppercase tracking-wider transition-transform duration-150 ease-candy active:scale-95 shrink-0 text-white"
            style={{ backgroundColor: flavor.base }}
            aria-label={`Run ${skill.name}`}
          >
            <Play className="w-2.5 h-2.5 fill-current" />
            run
          </button>
        </div>
      </div>
    </article>
  );
}
