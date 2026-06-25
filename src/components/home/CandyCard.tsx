/**
 * CandyCard — dense product tile for the candy jar.
 *
 * The boutique way: the whole card is flooded with a MUTED PASTEL fill from
 * `getShell(category, isDark)` (dusty rose / sage / lavender in light; deep
 * same-hue tones in dark), with dark same-hue INK text on top. A candy EMOJI
 * (`getCandyEmoji(skill.id)`) carries the playful glyph — no SVG illustration.
 *
 * Composition:
 *   Top row     : big emoji · category chip · pick/paid/hosted badge
 *   Title       : 2 lines max, line-clamp-2 with ellipsis, Fredoka
 *   Description : 2 lines line-clamp, secondary ink
 *   Tags        : #tag #tag #tag — first 3 tags, mono (optional)
 *   Meta        : @author · ★ rating · installs (single mono row)
 *   Action      : single RUN pill bottom-right (accent ink)
 *
 * Elevation: resting shadow-candy-1, hover shadow-candy-2 + -translate-y-1 with
 * ease-candy. Light + dark both read premium via getShell.
 *
 * Like / cart are inline quick actions (top-right cluster); the card body click
 * opens the canonical detail page (/candy/:id). Props are STABLE — callers
 * (SkillsGrid, ShopWindow, MostPopularRail, detail pages) pass the same shape.
 */

import { Star, Play, Sparkles, Zap, Users, Heart, ShoppingBag, Check } from 'lucide-react';
import type { Skill } from '../../data/skillsData';
import { getFormat } from '../../data/skillsData';
import { cn } from '../../utils/cn';
import { useIsDark } from '../../hooks/useIsDark';
import { getShell, getFlavor } from '../../utils/candyShells';
import { getCandyEmoji } from '../../utils/candy';
import { getRuntime } from '../../lib/runtimes/registry';

interface CandyCardProps {
  skill: Skill;
  index: number;
  isFeatured?: boolean;
  /** Drives the inline like/cart quick-action cluster (top-right). */
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
  isLiked = false,
  isInCart = false,
  onSelect,
  onRun,
  onLike,
  onToggleCart,
}: CandyCardProps) {
  const isDark = useIsDark();
  const shell = getShell(skill.category, isDark);
  const rating = deriveRating(skill);
  const emoji = getCandyEmoji(skill.id);

  // ── Format chip: non-claude formats get a clear type chip (n8n / Dify /
  //    LangGraph / Workflow) in the format's accent flavor. claude-skill is the
  //    default and stays unbadged so existing skill cards look unchanged.
  const format = getFormat(skill);
  const runtime = getRuntime(format);
  const formatFlavor = getFlavor(runtime.accentFlavor, isDark);
  const showFormatChip = format !== 'claude-skill';

  const isUserCandy = skill.id.startsWith('user-candy-');
  const isManaged = skill.executionModel === 'managed';
  const isPaid = skill.price !== undefined && skill.price > 0;

  const authorHandle = skill.developer ?? skill.repo?.split('/')[0];
  const description = (skill.description && skill.description.length > 8)
    ? skill.description
    : fallbackDescription(skill);
  const visibleTags = (skill.tags ?? []).filter((t) => t && t.length > 0).slice(0, 3);

  // ── Badge logic: ONE category chip + ONE optional status badge
  let statusBadge: { label: string; icon?: typeof Sparkles } | null = null;
  if (isUserCandy)           statusBadge = { label: 'yours',  icon: Sparkles };
  else if (skill.editorPick) statusBadge = { label: 'pick',   icon: Sparkles };
  else if (isPaid)           statusBadge = { label: `$${(skill.price! / 100).toFixed(0)}` };
  else if (isManaged)        statusBadge = { label: 'hosted', icon: Zap };

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
        'rounded-2xl border border-black/5 dark:border-white/5',
        isDark ? 'shadow-candy-1-dark hover:shadow-candy-2-dark' : 'shadow-candy-1 hover:shadow-candy-2',
        'hover:-translate-y-1 transition-[transform,box-shadow] duration-300 ease-candy',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        shell.ring,
      )}
      style={{ backgroundColor: shell.bg, color: shell.text }}
    >
      {/* Quick actions — like + bag, top-right. Revealed on hover/focus, but
          kept visible whenever active so the state is never hidden. Each
          stops propagation so it never triggers the card's navigation. */}
      <div
        className={cn(
          'absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 transition-opacity duration-200',
          isLiked || isInCart
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
        )}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onLike?.(); }}
          aria-label={isLiked ? `Unlike ${skill.name}` : `Like ${skill.name}`}
          aria-pressed={isLiked}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full backdrop-blur-sm shadow-sm transition-transform duration-150 ease-candy active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ backgroundColor: shell.chipBg, color: isLiked ? shell.accent : shell.text }}
        >
          <Heart className={cn('w-3.5 h-3.5', isLiked && 'fill-current')} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCart?.(); }}
          aria-label={isInCart ? `Remove ${skill.name} from bag` : `Add ${skill.name} to bag`}
          aria-pressed={isInCart}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full backdrop-blur-sm shadow-sm transition-transform duration-150 ease-candy active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ backgroundColor: isInCart ? shell.accent : shell.chipBg, color: isInCart ? '#ffffff' : shell.text }}
        >
          {isInCart ? <Check className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div
        className={cn(
          'flex flex-col gap-2.5',
          isFeatured ? 'p-5 md:p-6' : 'p-4 md:p-[18px]'
        )}
      >
        {/* ── Top row: emoji · category chip · status badge ── */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              'shrink-0 leading-none select-none',
              'transition-transform duration-300 ease-candy group-hover:scale-110',
              isFeatured ? 'text-5xl' : 'text-[40px]'
            )}
            aria-hidden="true"
          >
            {emoji}
          </span>
          <div className="flex flex-col items-start gap-1 min-w-0">
            <div className="flex items-center gap-1 min-w-0 flex-wrap">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-widest truncate max-w-full"
                style={{ backgroundColor: shell.chipBg, color: shell.text }}
              >
                {skill.category}
              </span>
              {/* Format type chip — only for non-claude formats so users can
                  tell n8n / Dify / LangGraph / Workflow apart at a glance. */}
              {showFormatChip && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest truncate max-w-full border"
                  style={{
                    backgroundColor: formatFlavor.tint,
                    color: formatFlavor.ink,
                    borderColor: formatFlavor.base,
                  }}
                  title={runtime.label}
                >
                  {runtime.shortLabel}
                </span>
              )}
            </div>
            {statusBadge && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest text-white"
                style={{ backgroundColor: shell.accent }}
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
            'font-candy font-semibold leading-[1.15] line-clamp-2',
            isFeatured ? 'text-xl md:text-2xl' : 'text-base md:text-[17px]'
          )}
          style={{ color: shell.text }}
          title={skill.name}
        >
          {skill.name}
        </h3>

        {/* ── Description: 2 lines line-clamp ── */}
        <p
          className={cn(
            'font-body line-clamp-2 leading-snug opacity-80',
            isFeatured ? 'text-sm' : 'text-xs md:text-[13px]'
          )}
          style={{ color: shell.text }}
        >
          {description}
        </p>

        {/* ── Tags row (optional) ── */}
        {visibleTags.length > 0 && (
          <div
            className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] md:text-[11px] font-mono leading-tight min-w-0 opacity-65"
            style={{ color: shell.text }}
          >
            {visibleTags.map((tag) => (
              <span key={tag} className="truncate max-w-[110px]">#{tag.toLowerCase()}</span>
            ))}
          </div>
        )}

        {/* ── Meta + action row ── */}
        <div className="flex items-center justify-between gap-2 pt-1 mt-auto">
          <div
            className="flex items-center gap-1.5 text-[10px] md:text-[11px] font-mono min-w-0 flex-1 opacity-75"
            style={{ color: shell.text }}
          >
            {authorHandle && (
              <>
                <span className="truncate max-w-[88px]">@{authorHandle}</span>
                <span aria-hidden className="opacity-50">·</span>
              </>
            )}
            <span className="flex items-center gap-0.5 shrink-0" style={{ color: shell.accent }}>
              <Star className="w-2.5 h-2.5 fill-current" />
              <span className="font-bold">{rating.toFixed(1)}</span>
            </span>
            <span aria-hidden className="opacity-50">·</span>
            <span className="flex items-center gap-0.5 shrink-0">
              <Users className="w-2.5 h-2.5" />
              {formatInstalls(skill.popularity)}
            </span>
          </div>

          {/* Action — single RUN pill in the accent ink. Like / cart are the top-right cluster. */}
          <button
            onClick={(e) => { e.stopPropagation(); onRun(); }}
            className="inline-flex items-center justify-center gap-1 h-7 px-3 rounded-full text-[10px] font-body font-bold uppercase tracking-wider transition-transform duration-150 ease-candy active:scale-95 shrink-0 text-white"
            style={{ backgroundColor: shell.accent }}
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
