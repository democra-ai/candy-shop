import { X, Copy, Check, Terminal, Play, Github, ExternalLink, FileText, Star, Users, Code2, ChevronDown, ChevronUp, Share2, Zap, Shield } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Skill } from '../../data/skillsData';
import { LineageBadge, PricingBadge, ExecutionModelBadge, ManifestVisibilityBadge } from './LineageBadge';
import { toast } from 'sonner';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { getCandyEmoji } from '../../utils/candy';
import { storageUtils } from '../../utils/storage';
import { cn } from '../../utils/cn';

const getCategoryModalColor = (category: string): { bg: string; border: string } => {
  const map: Record<string, { bg: string; border: string }> = {
    Development: { bg: 'bg-blue-500/15 dark:bg-blue-500/20', border: 'border-blue-500/20' },
    Design: { bg: 'bg-pink-500/15 dark:bg-pink-500/20', border: 'border-pink-500/20' },
    Marketing: { bg: 'bg-orange-500/15 dark:bg-orange-500/20', border: 'border-orange-500/20' },
    Productivity: { bg: 'bg-emerald-500/15 dark:bg-emerald-500/20', border: 'border-emerald-500/20' },
    Tools: { bg: 'bg-violet-500/15 dark:bg-violet-500/20', border: 'border-violet-500/20' },
    Research: { bg: 'bg-cyan-500/15 dark:bg-cyan-500/20', border: 'border-cyan-500/20' },
    Mobile: { bg: 'bg-lime-500/15 dark:bg-lime-500/20', border: 'border-lime-500/20' },
    Writing: { bg: 'bg-yellow-500/15 dark:bg-yellow-500/20', border: 'border-yellow-500/20' },
  };
  return map[category] || { bg: 'bg-secondary', border: 'border-border' };
};

// Generate pseudo-stable values from skill data
function deriveRating(skill: Skill): number {
  if (skill.rating) return skill.rating;
  // Derive a stable 3.5-5.0 rating from name hash
  let hash = 0;
  for (let i = 0; i < skill.name.length; i++) hash = ((hash << 5) - hash + skill.name.charCodeAt(i)) | 0;
  return Math.round((3.5 + (Math.abs(hash) % 15) / 10) * 10) / 10;
}

function deriveUsers(skill: Skill): string {
  if (skill.users) {
    if (skill.users >= 10000) return `${(skill.users / 10000).toFixed(1)}w`;
    if (skill.users >= 1000) return `${(skill.users / 1000).toFixed(1)}k`;
    return skill.users.toString();
  }
  const pop = skill.popularity || 0;
  if (pop >= 10000) return `${(pop / 10000).toFixed(1)}w`;
  if (pop >= 1000) return `${(pop / 1000).toFixed(1)}k`;
  return pop > 0 ? pop.toString() : '—';
}

function deriveVersion(skill: Skill): string {
  if (skill.version) return skill.version;
  // Derive stable version from id hash
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

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            iconSize,
            star <= Math.floor(rating)
              ? 'fill-caramel text-caramel'
              : star <= rating
              ? 'fill-caramel/50 text-caramel'
              : 'text-foreground-muted'
          )}
        />
      ))}
    </div>
  );
}

interface SkillModalProps {
  skill: Skill | null;
  onClose: () => void;
  onRun?: (skill: Skill) => void;
}

export function SkillModal({ skill, onClose, onRun }: SkillModalProps) {
  const [copied, setCopied] = useState(false);
  const [installCopied, setInstallCopied] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, !!skill);

  useEffect(() => {
    if (skill) {
      document.body.style.overflow = 'hidden';
      setDescExpanded(false);
      setUserRating(0);
    }
    return () => { document.body.style.overflow = ''; };
  }, [skill]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!skill) return null;

  const configString = JSON.stringify(skill.config, null, 2);
  const rating = deriveRating(skill);
  const developer = deriveDeveloper(skill);
  const version = deriveVersion(skill);
  const usersStr = deriveUsers(skill);
  const isOpenSource = skill.openSource !== undefined ? skill.openSource : !!skill.repo;

  const handleCopy = () => {
    navigator.clipboard.writeText(configString);
    setCopied(true);
    toast.success('Config copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInstall = () => {
    navigator.clipboard.writeText(skill.installCommand);
    setInstallCopied(true);
    toast.success('Install command copied');
    setTimeout(() => setInstallCopied(false), 2000);
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

  // Determine if description is long enough to need expand/collapse
  const descIsLong = skill.description.length > 160;
  const displayDesc = descExpanded || !descIsLong
    ? skill.description
    : skill.description.slice(0, 160) + '...';

  // Generate showcase items from tags if not provided
  const showcases: Array<{ title: string; image?: string }> = skill.showcases || skill.tags.slice(0, 3).map((tag) => ({
    title: `${tag} workflow`,
  }));

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${skill.name} details`}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-card rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-border">
        {/* Top Bar — Share & Close */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2.5 bg-background/60 hover:bg-background rounded-full transition-colors duration-200 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Share"
          >
            <Share2 className="w-4 h-4 text-foreground-secondary" />
          </button>
          <button
            onClick={onClose}
            className="p-2.5 bg-background/60 hover:bg-background rounded-full transition-colors duration-200 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-foreground-secondary" />
          </button>
        </div>

        {/* Header — Icon + Name */}
        <div
          className={cn(
            'pt-10 pb-6 px-8 flex flex-col items-center text-center border-b',
            getCategoryModalColor(skill.category).bg,
            getCategoryModalColor(skill.category).border
          )}
        >
          <div className="text-6xl mb-4 animate-candy-float" aria-hidden="true">{getCandyEmoji(skill.id)}</div>
          <h2 className="text-2xl font-candy font-bold text-foreground">{skill.name}</h2>
          <p className="text-sm text-foreground-secondary mt-1 max-w-md font-body">
            {skill.description.length > 80 ? skill.description.slice(0, 80) + '...' : skill.description}
          </p>

          {/* Info Bar — like the screenshot */}
          <div className="mt-5 w-full grid grid-cols-3 sm:grid-cols-6 gap-px bg-border/30 rounded-xl overflow-hidden border border-border/50">
            {/* Rating */}
            <div className="bg-card/80 backdrop-blur-sm py-3 px-2 flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-foreground">{rating}</span>
              </div>
              <StarDisplay rating={rating} />
              <span className="text-[10px] text-foreground-tertiary">Rating</span>
            </div>
            {/* Category */}
            <div className="bg-card/80 backdrop-blur-sm py-3 px-2 flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-foreground truncate max-w-full">{skill.category}</span>
              <span className="text-[10px] text-foreground-tertiary">Category</span>
            </div>
            {/* Developer */}
            <div className="bg-card/80 backdrop-blur-sm py-3 px-2 flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-foreground truncate max-w-full">{developer}</span>
              <span className="text-[10px] text-foreground-tertiary">Developer</span>
            </div>
            {/* Version */}
            <div className="bg-card/80 backdrop-blur-sm py-3 px-2 flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-foreground">{version}</span>
              <span className="text-[10px] text-foreground-tertiary">Version</span>
            </div>
            {/* Users */}
            <div className="bg-card/80 backdrop-blur-sm py-3 px-2 flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-foreground">{usersStr}</span>
              <span className="text-[10px] text-foreground-tertiary">Users</span>
            </div>
            {/* Open Source */}
            <div className="bg-card/80 backdrop-blur-sm py-3 px-2 flex flex-col items-center gap-1">
              <span className={cn('text-sm font-bold', isOpenSource ? 'text-green-500' : 'text-foreground')}>
                {isOpenSource ? 'Yes' : 'No'}
              </span>
              <span className="text-[10px] text-foreground-tertiary">Open Source</span>
            </div>
          </div>

          {/* Lineage & Execution Model Bar */}
          {(skill.lineage || skill.executionModel || skill.pricingModel) && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <LineageBadge lineage={skill.lineage} size="sm" />
              <PricingBadge pricingModel={skill.pricingModel} price={skill.price} size="sm" />
              <ExecutionModelBadge model={skill.executionModel} size="sm" />
              <ManifestVisibilityBadge visibility={skill.manifestVisibility} size="sm" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-8 py-6 overflow-y-auto flex-1">
          {/* Description (expandable) */}
          <div className="mb-6">
            <p className="text-foreground-secondary text-sm font-body leading-relaxed">
              {displayDesc}
            </p>
            {descIsLong && (
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="mt-1 flex items-center gap-1 text-xs text-primary hover:text-primary-hover transition-colors"
              >
                {descExpanded ? (
                  <>Collapse <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>Expand <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>

          {skill.greeting && (
            <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Greeting:</p>
              <p className="text-foreground-secondary text-sm italic">"{skill.greeting}"</p>
            </div>
          )}

          {/* Showcases / Featured Use Cases */}
          {showcases.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-foreground mb-3">Featured Use Cases</h3>
              <div className="grid grid-cols-3 gap-3">
                {showcases.map((showcase, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border/50 overflow-hidden bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-default"
                  >
                    <div className={cn(
                      'h-20 flex items-center justify-center text-3xl',
                      getCategoryModalColor(skill.category).bg,
                    )}>
                      {showcase.image ? (
                        <img src={showcase.image} alt={showcase.title} className="w-full h-full object-cover" />
                      ) : (
                        <span>{getCandyEmoji(skill.id + i)}</span>
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

          {/* Execution Rights Notice (for managed/paid skills) */}
          {skill.executionModel === 'managed' && (
            <div className="mb-6 p-4 bg-amber-500/5 rounded-lg border border-amber-500/20">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">Execution Rights Model</h3>
                  <p className="text-xs text-foreground-secondary leading-relaxed">
                    This skill sells <strong>execution rights</strong>, not source files. The manifest (description, API schema, capabilities) is visible, but the runtime logic and policy core are gated behind entitlement.
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

          {/* Install / Invoke Command */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
              {skill.executionModel === 'managed' ? <Zap className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
              {skill.executionModel === 'managed' ? 'Invoke Command' : 'Quick Install'}
            </h3>
            <div className="bg-zinc-900 text-zinc-100 p-4 rounded-lg font-mono text-sm overflow-x-auto flex items-center justify-between group">
              <code className="break-all">{skill.installCommand}</code>
              <button
                onClick={handleCopyInstall}
                className="shrink-0 ml-2 p-2 hover:bg-white/10 rounded transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20"
                aria-label="Copy install command"
              >
                {installCopied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            </div>
          </div>

          {/* Source Links */}
          <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Source & Documentation
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`https://github.com/${skill.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg hover:bg-accent hover:border-primary/30 transition-all duration-200 cursor-pointer group"
              >
                <Github className="w-4 h-4 text-foreground-secondary group-hover:text-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">GitHub Repository</div>
                  <div className="text-sm font-medium text-foreground truncate">{skill.repo}</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </a>
              <a
                href={skill.skillMdUrl.replace('raw.githubusercontent.com', 'github.com').replace('/main/', '/blob/main/')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg hover:bg-accent hover:border-primary/30 transition-all duration-200 cursor-pointer group"
              >
                <FileText className="w-4 h-4 text-foreground-secondary group-hover:text-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Documentation</div>
                  <div className="text-sm font-medium text-foreground">SKILL.md</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
              </a>
            </div>
          </div>

          {/* Rating Section */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-foreground mb-3">Rating</h3>
            <div className="flex items-start gap-6">
              {/* Average */}
              <div className="text-center">
                <div className="text-4xl font-bold text-foreground font-candy">{rating}</div>
                <StarDisplay rating={rating} size="md" />
              </div>
              {/* Rating Bars */}
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  // Derive pseudo distribution from rating
                  const dist = star === Math.round(rating) ? 0.6
                    : Math.abs(star - rating) <= 1 ? 0.25
                    : Math.abs(star - rating) <= 2 ? 0.1
                    : 0.05;
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-xs text-foreground-secondary w-8">{star} star</span>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-caramel rounded-full transition-all duration-500"
                          style={{ width: `${dist * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* User Rating */}
            <div className="mt-4 p-3 bg-secondary/30 rounded-lg border border-border/50">
              <p className="text-xs text-foreground-secondary mb-2">Rate this skill</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleUserRate(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-0.5 transition-transform hover:scale-125"
                  >
                    <Star
                      className={cn(
                        'w-6 h-6 transition-colors',
                        star <= (hoverRating || userRating)
                          ? 'fill-caramel text-caramel'
                          : 'text-foreground-muted hover:text-caramel/50'
                      )}
                    />
                  </button>
                ))}
                {userRating > 0 && (
                  <span className="ml-2 text-xs text-foreground-secondary">
                    You rated {userRating}/5
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Config JSON */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground">Claude Desktop Config</h3>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 rounded px-2 py-1"
                aria-label={copied ? 'Copied to clipboard' : 'Copy config to clipboard'}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Config'}
              </button>
            </div>

            <div className="bg-secondary border border-border rounded-xl p-4 font-mono text-sm text-foreground-secondary overflow-auto max-h-64 shadow-inner">
              <pre>{configString}</pre>
            </div>
          </div>
        </div>

        {/* Footer Action — sticky bottom */}
        <div className="p-4 border-t border-border bg-card flex justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-foreground-tertiary">
            <Users className="w-3.5 h-3.5" />
            <span>{usersStr} users</span>
            <span className="text-border">·</span>
            <Code2 className="w-3.5 h-3.5" />
            <span>{version}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-transparent text-foreground-secondary border border-border rounded-lg font-medium hover:bg-secondary hover:text-foreground transition-colors duration-200 cursor-pointer min-h-[40px] focus:outline-none focus:ring-2 focus:ring-border"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (onRun && skill) {
                  onRun(skill);
                  onClose();
                }
              }}
              className={cn(
                'px-6 py-2.5 rounded-lg font-medium transition-colors duration-200 shadow-lg flex items-center gap-2 cursor-pointer min-h-[40px] focus:outline-none focus:ring-2',
                skill.executionModel === 'managed'
                  ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20 focus:ring-amber-500/50'
                  : 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-primary/20 focus:ring-primary/50'
              )}
              aria-label={`${skill.executionModel === 'managed' ? 'Invoke' : 'Run'} ${skill.name}`}
            >
              {skill.executionModel === 'managed' ? <Zap className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {skill.executionModel === 'managed' ? (skill.price ? `Invoke ($${(skill.price / 100).toFixed(2)})` : 'Invoke') : 'Run Skill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
