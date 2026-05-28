import { Copy, Check, Terminal, Play, Github, ExternalLink, FileText, Star, Users, ChevronDown, ChevronUp, Share2, Zap, Shield, Heart, ShoppingBag } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Skill } from '../../data/skillsData';
import { LineageBadge, PricingBadge, ExecutionModelBadge, ManifestVisibilityBadge } from './LineageBadge';
import { toast } from 'sonner';
import { storageUtils } from '../../utils/storage';
import { cn } from '../../utils/cn';
import { useIsDark } from '../../hooks/useIsDark';
import { getFlavor } from '../../utils/candyShells';
import { getCandyIcon } from '../illustrations';
import { ModalShell } from '../ui/ModalShell';

// Generate pseudo-stable values from skill data
function deriveRating(skill: Skill): number {
  if (skill.rating) return skill.rating;
  let hash = 0;
  for (let i = 0; i < skill.name.length; i++) hash = ((hash << 5) - hash + skill.name.charCodeAt(i)) | 0;
  return Math.round((3.5 + (Math.abs(hash) % 15) / 10) * 10) / 10;
}

function deriveUsers(skill: Skill): string {
  const raw = skill.users ?? skill.popularity ?? 0;
  if (raw >= 1_000_000) return `${(raw / 1_000_000).toFixed(1)}M`;
  if (raw >= 1_000) return `${(raw / 1_000).toFixed(raw >= 10_000 ? 0 : 1)}k`;
  return raw > 0 ? String(raw) : '—';
}

function deriveVersion(skill: Skill): string {
  if (skill.version) return skill.version;
  let hash = 0;
  for (let i = 0; i < skill.id.length; i++) hash = ((hash << 5) - hash + skill.id.charCodeAt(i)) | 0;
  const major = 1 + (Math.abs(hash) % 3);
  const minor = Math.abs(hash >> 4) % 10;
  return `v${major}.${minor}`;
}

function deriveDeveloper(skill: Skill): string {
  if (skill.developer) return skill.developer;
  if (skill.repo) {
    const owner = skill.repo.split('/')[0];
    if (owner) return owner;
  }
  return 'Community';
}

/** Star row tinted to the category ink so it reads as part of the candy header. */
function StarDisplay({ rating, size = 'sm', color }: { rating: number; size?: 'sm' | 'md'; color?: string }) {
  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);
        return (
          <Star
            key={star}
            className={cn(iconSize, !color && (filled ? 'fill-warning text-warning' : 'text-foreground-muted'))}
            style={color ? { color, fill: filled ? color : 'transparent', opacity: filled ? 1 : 0.35 } : undefined}
          />
        );
      })}
    </div>
  );
}

interface SkillModalProps {
  skill: Skill | null;
  onClose: () => void;
  onRun?: (skill: Skill) => void;
  /** Optional — when omitted, like state falls back to local storage. */
  isLiked?: boolean;
  onLike?: (skill: Skill) => void;
  /** Optional — when omitted, cart state falls back to local storage. */
  isInCart?: boolean;
  onToggleCart?: (skill: Skill) => void;
}

export function SkillModal({ skill, onClose, onRun, isLiked, onLike, isInCart, onToggleCart }: SkillModalProps) {
  const isDark = useIsDark();
  const [installCopied, setInstallCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  // Local fallbacks so Like / Add-to-bag work even when no handler is wired.
  const [localLiked, setLocalLiked] = useState(false);
  const [localCarted, setLocalCarted] = useState(false);

  useEffect(() => {
    if (skill) {
      setDescExpanded(false);
      setUserRating(0);
      setLocalLiked(storageUtils.isLiked(skill.id));
      setLocalCarted(storageUtils.getCart().includes(skill.id));
    }
  }, [skill]);

  if (!skill) return null;

  const flavor = getFlavor(skill.category, isDark);
  const Candy = getCandyIcon(skill.category, isDark);
  const rating = deriveRating(skill);
  const developer = deriveDeveloper(skill);
  const version = deriveVersion(skill);
  const usersStr = deriveUsers(skill);
  const isOpenSource = skill.openSource !== undefined ? skill.openSource : !!skill.repo;
  const isManaged = skill.executionModel === 'managed';
  const liked = isLiked ?? localLiked;
  const inCart = isInCart ?? localCarted;
  const configString = JSON.stringify(skill.config, null, 2);
  const hasConfig = skill.config && Object.keys(skill.config).length > 0;

  const handleCopyInstall = () => {
    navigator.clipboard.writeText(skill.installCommand);
    setInstallCopied(true);
    toast.success('Install command copied');
    setTimeout(() => setInstallCopied(false), 2000);
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(configString);
    setConfigCopied(true);
    toast.success('Config copied to clipboard');
    setTimeout(() => setConfigCopied(false), 2000);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/candy/${skill.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handleUserRate = (score: number) => {
    setUserRating(score);
    storageUtils.saveLike(skill.id);
    toast.success(`Rated ${skill.name} ${score} stars`);
  };

  const handleLike = () => {
    if (onLike) { onLike(skill); return; }
    const next = !localLiked;
    setLocalLiked(next);
    if (next) { storageUtils.saveLike(skill.id); toast.success('Added to favorites'); }
    else { storageUtils.removeLike(skill.id); toast('Removed from favorites'); }
  };

  const handleToggleCart = () => {
    if (onToggleCart) { onToggleCart(skill); return; }
    const cart = storageUtils.getCart();
    const next = !localCarted;
    setLocalCarted(next);
    if (next) {
      storageUtils.saveCart([...new Set([...cart, skill.id])]);
      toast.success('Added to bag');
    } else {
      storageUtils.saveCart(cart.filter((id) => id !== skill.id));
      toast('Removed from bag');
    }
  };

  const descIsLong = skill.description.length > 200;
  const displayDesc = descExpanded || !descIsLong
    ? skill.description
    : skill.description.slice(0, 200) + '…';

  const showcases: Array<{ title: string; image?: string; emoji?: string }> =
    skill.showcases || skill.tags.slice(0, 3).map((tag) => ({ title: `${tag} workflow` }));

  return (
    <ModalShell
      open={!!skill}
      onClose={onClose}
      label={`${skill.name} details`}
      maxWidth="2xl"
      padded={false}
      hideClose
    >
      {/* ── Top controls: share + close (over the colored header) ── */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={handleShare}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-card/70 backdrop-blur-sm hover:bg-card transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          style={{ color: flavor.ink }}
          aria-label="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-card/70 backdrop-blur-sm hover:bg-card transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          style={{ color: flavor.ink }}
          aria-label="Close"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* ── Candy header — subtle flavor tint band + illustration (DESIGN.md §2/§4) ── */}
      <div
        className="px-6 sm:px-8 pt-10 pb-6 flex flex-col items-center text-center shrink-0"
        style={{ backgroundColor: flavor.tint, color: flavor.ink }}
      >
        <div
          className="flex items-center justify-center w-20 h-20 rounded-3xl mb-3 bg-card shadow-candy-1"
          aria-hidden="true"
        >
          <Candy size={52} color={flavor.base} />
        </div>
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium uppercase tracking-widest mb-2"
          style={{ backgroundColor: flavor.base, color: flavor.tint }}
        >
          {skill.category}
        </span>
        <h2 className="text-2xl font-candy font-bold leading-tight" style={{ color: flavor.ink }}>{skill.name}</h2>

        {/* meta row — author · rating · users */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-mono" style={{ color: flavor.ink }}>
          <span>@{developer}</span>
          <span className="opacity-40" aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <StarDisplay rating={rating} color={flavor.base} />
            <span className="font-bold">{rating.toFixed(1)}</span>
          </span>
          <span className="opacity-40" aria-hidden>·</span>
          <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{usersStr}</span>
          <span className="opacity-40" aria-hidden>·</span>
          <span>{version}</span>
        </div>

        {/* Lineage & execution badges */}
        {(skill.lineage || skill.executionModel || skill.pricingModel) && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <LineageBadge lineage={skill.lineage} size="sm" />
            <PricingBadge pricingModel={skill.pricingModel} price={skill.price} size="sm" />
            <ExecutionModelBadge model={skill.executionModel} size="sm" />
            <ManifestVisibilityBadge visibility={skill.manifestVisibility} size="sm" />
          </div>
        )}
      </div>

      {/* ── Body — token surfaces ── */}
      <div className="px-6 sm:px-8 py-6 overflow-y-auto flex-1 space-y-6">
        {/* Description */}
        <div>
          <p className="text-foreground-secondary text-sm font-body leading-relaxed whitespace-pre-line">
            {displayDesc}
          </p>
          {descIsLong && (
            <button
              onClick={() => setDescExpanded(!descExpanded)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
            >
              {descExpanded ? <>Show less <ChevronUp className="w-3 h-3" /></> : <>Read more <ChevronDown className="w-3 h-3" /></>}
            </button>
          )}
        </div>

        {/* Tags */}
        {skill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {skill.tags.map((tag) => (
              <span key={tag} className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-secondary text-foreground-secondary">
                #{tag.toLowerCase()}
              </span>
            ))}
          </div>
        )}

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {[
            { label: 'Rating', value: rating.toFixed(1) },
            { label: 'Users', value: usersStr },
            { label: 'Version', value: version },
            { label: 'Category', value: skill.category },
            { label: 'Developer', value: developer },
            { label: 'Open source', value: isOpenSource ? 'Yes' : 'No' },
          ].map((s) => (
            <div key={s.label} className="bg-card py-3 px-2 flex flex-col items-center gap-0.5">
              <span className="text-sm font-bold text-foreground truncate max-w-full">{s.value}</span>
              <span className="text-[10px] text-foreground-tertiary uppercase tracking-wide">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Greeting */}
        {skill.greeting && (
          <div className="p-4 bg-secondary/50 rounded-xl border border-border">
            <p className="text-[11px] text-foreground-tertiary font-mono uppercase tracking-wide mb-1">Greeting</p>
            <p className="text-foreground-secondary text-sm italic">"{skill.greeting}"</p>
          </div>
        )}

        {/* Featured use cases */}
        {showcases.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Featured use cases</h3>
            <div className="grid grid-cols-3 gap-3">
              {showcases.map((showcase, i) => (
                <div key={i} className="rounded-xl border border-border overflow-hidden bg-secondary/40">
                  <div className="h-20 flex items-center justify-center" style={{ backgroundColor: flavor.tint }}>
                    {showcase.image ? (
                      <img src={showcase.image} alt={showcase.title} className="w-full h-full object-cover" />
                    ) : (
                      <span aria-hidden="true"><Candy size={36} color={flavor.base} /></span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-foreground truncate">{showcase.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Execution rights notice */}
        {isManaged && (
          <div className="p-4 bg-warning/5 rounded-xl border border-warning/20">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-warning mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1">Execution rights model</h3>
                <p className="text-xs text-foreground-secondary leading-relaxed">
                  This skill sells <strong>execution rights</strong>, not source files. The manifest is visible, but the runtime logic is gated behind entitlement.
                  {skill.pricingModel === 'per_call' && ' You pay per invocation — both humans (Stripe) and agents (x402) can invoke.'}
                </p>
                {skill.lineage?.type === 'licensed_derivative' && skill.lineage.originalAuthor && (
                  <p className="text-xs text-foreground-tertiary mt-2">
                    Derived from work by <strong>{skill.lineage.originalAuthor}</strong> — revenue is shared with the original creator.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Install / Invoke command */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            {isManaged ? <Zap className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
            {isManaged ? 'Invoke command' : 'Quick install'}
          </h3>
          <div className="bg-secondary border border-border rounded-xl p-3.5 font-mono text-sm flex items-center justify-between gap-2">
            <code className="break-all text-foreground">{skill.installCommand}</code>
            <button
              onClick={handleCopyInstall}
              className="shrink-0 p-2 rounded-lg hover:bg-card transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Copy install command"
            >
              {installCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-foreground-secondary" />}
            </button>
          </div>
        </div>

        {/* Source & docs */}
        {(skill.repo || skill.skillMdUrl) && (
          <div className="p-4 bg-secondary/40 rounded-xl border border-border">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Source & documentation
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              {skill.repo && (
                <a
                  href={`https://github.com/${skill.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl hover:border-border-hover transition-colors group flex-1 min-w-0"
                >
                  <Github className="w-4 h-4 text-foreground-secondary group-hover:text-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-foreground-tertiary">GitHub repository</div>
                    <div className="text-sm font-medium text-foreground truncate">{skill.repo}</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-foreground-tertiary group-hover:text-foreground shrink-0" />
                </a>
              )}
              {skill.skillMdUrl && (
                <a
                  href={skill.skillMdUrl.replace('raw.githubusercontent.com', 'github.com').replace('/main/', '/blob/main/')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-xl hover:border-border-hover transition-colors group flex-1 min-w-0"
                >
                  <FileText className="w-4 h-4 text-foreground-secondary group-hover:text-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-foreground-tertiary">Documentation</div>
                    <div className="text-sm font-medium text-foreground">SKILL.md</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-foreground-tertiary group-hover:text-foreground shrink-0" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Rate this skill */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-2">Rate this skill</h3>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleUserRate(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-0.5 transition-transform hover:scale-110"
                aria-label={`Rate ${star} stars`}
              >
                <Star className={cn('w-6 h-6 transition-colors', star <= (hoverRating || userRating) ? 'fill-warning text-warning' : 'text-foreground-muted')} />
              </button>
            ))}
            {userRating > 0 && <span className="ml-2 text-xs text-foreground-secondary">You rated {userRating}/5</span>}
          </div>
        </div>

        {/* Config */}
        {hasConfig && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground">Claude Desktop config</h3>
              <button
                onClick={handleCopyConfig}
                className="flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary-hover transition-colors"
                aria-label={configCopied ? 'Copied' : 'Copy config'}
              >
                {configCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {configCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="bg-secondary border border-border rounded-xl p-4 font-mono text-sm text-foreground-secondary overflow-auto max-h-64">
              <pre>{configString}</pre>
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky action footer: Like · Add to bag · Run ── */}
      <div className="p-4 border-t border-border bg-card flex items-center gap-3 shrink-0">
        <button
          onClick={handleLike}
          className={cn(
            'inline-flex items-center justify-center w-10 h-10 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-ring shrink-0',
            liked ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border bg-card text-foreground-secondary hover:border-border-hover hover:text-foreground'
          )}
          aria-label={liked ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={liked}
        >
          <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
        </button>
        <button
          onClick={handleToggleCart}
          className={cn(
            'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
            inCart ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border bg-card text-foreground hover:border-border-hover hover:bg-secondary'
          )}
          aria-pressed={inCart}
        >
          <ShoppingBag className="w-4 h-4" />
          {inCart ? 'In bag' : 'Add to bag'}
        </button>
        <button
          onClick={() => { if (onRun && skill) { onRun(skill); onClose(); } }}
          className="candy-btn btn-press ml-auto inline-flex items-center justify-center gap-2 h-10 px-6 rounded-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={`${isManaged ? 'Invoke' : 'Run'} ${skill.name}`}
        >
          {isManaged ? <Zap className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          {isManaged ? (skill.price ? `Invoke ($${(skill.price / 100).toFixed(2)})` : 'Invoke') : 'Run'}
        </button>
      </div>
    </ModalShell>
  );
}
