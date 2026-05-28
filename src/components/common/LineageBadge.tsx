import { Sparkle, GitFork, Recycle, Copyright, BadgeCheck, Cloud, Link2, FileText, Lock, CircleDollarSign, type LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { SkillLineage, ExecutionModel, ManifestVisibility } from '../../data/skillsData';

// Badges are tinted from semantic design tokens (success / info / accent /
// warning / error / primary). Tailwind's `/opacity` modifier can't synthesize
// an alpha channel on these var()-based tokens, so the muted same-hue pill is
// built with color-mix — the same approach the design system already uses for
// .glass / .gumdrop. This keeps the tint correct in both light and dark mode.
function tintPill(tokenVar: string) {
  return {
    color: `var(${tokenVar})`,
    backgroundColor: `color-mix(in srgb, var(${tokenVar}) 12%, transparent)`,
    borderColor: `color-mix(in srgb, var(${tokenVar}) 28%, transparent)`,
  };
}

const PILL_CLASS = 'font-semibold px-1.5 py-0.5 rounded-full border font-mono inline-flex items-center gap-0.5';

// ── Lineage Badge ──────────────────────────────────────────
// Shows the provenance of a skill: original, fork, remix, or licensed derivative

const LINEAGE_CONFIG: Record<string, { label: string; token: string; Icon: LucideIcon }> = {
  original:            { label: 'Original',            token: '--color-success', Icon: Sparkle },
  fork:                { label: 'Fork',                token: '--color-info',    Icon: GitFork },
  remix:               { label: 'Remix',               token: '--color-accent',  Icon: Recycle },
  licensed_derivative: { label: 'Licensed Derivative', token: '--color-warning', Icon: Copyright },
};

interface LineageBadgeProps {
  lineage?: SkillLineage;
  size?: 'xs' | 'sm';
  showCanonical?: boolean;
}

export function LineageBadge({ lineage, size = 'sm', showCanonical = true }: LineageBadgeProps) {
  if (!lineage) return null;
  const config = LINEAGE_CONFIG[lineage.type] || LINEAGE_CONFIG.original;
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';
  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const { Icon } = config;

  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn(textSize, PILL_CLASS)} style={tintPill(config.token)}>
        <Icon className={iconSize} /> {config.label}
      </span>
      {showCanonical && lineage.canonical && (
        <span className={cn(textSize, PILL_CLASS)} style={tintPill('--color-primary')}>
          <BadgeCheck className={iconSize} /> Canonical
        </span>
      )}
    </span>
  );
}

// ── Execution Model Badge ──────────────────────────────────

const EXEC_CONFIG: Record<string, { label: string; token: string; desc: string }> = {
  open:      { label: 'Open',      token: '--color-success', desc: 'Self-hostable, run anywhere' },
  managed:   { label: 'Managed',   token: '--color-info',    desc: 'Runs on our infrastructure' },
  federated: { label: 'Federated', token: '--color-accent',  desc: 'Creator-hosted execution' },
};

interface ExecutionModelBadgeProps {
  model?: ExecutionModel;
  size?: 'xs' | 'sm';
}

export function ExecutionModelBadge({ model, size = 'sm' }: ExecutionModelBadgeProps) {
  if (!model || model === 'open') return null;
  const config = EXEC_CONFIG[model];
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';

  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span className={cn(textSize, 'font-medium inline-flex items-center gap-1')} style={{ color: `var(${config.token})` }} title={config.desc}>
      {model === 'managed' ? <Cloud className={iconSize} /> : <Link2 className={iconSize} />} {config.label}
    </span>
  );
}

// ── Manifest Visibility Indicator ──────────────────────────

const VIS_CONFIG: Record<string, { label: string; token: string; desc: string }> = {
  full:          { label: 'Full Access',    token: '--color-success', desc: 'Manifest and runtime fully visible' },
  manifest_only: { label: 'Manifest Only',  token: '--color-warning', desc: 'Manifest visible, runtime gated' },
  private:       { label: 'Private',        token: '--color-error',   desc: 'Access requires entitlement' },
};

interface ManifestVisibilityBadgeProps {
  visibility?: ManifestVisibility;
  size?: 'xs' | 'sm';
}

export function ManifestVisibilityBadge({ visibility, size = 'sm' }: ManifestVisibilityBadgeProps) {
  if (!visibility || visibility === 'full') return null;
  const config = VIS_CONFIG[visibility];
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';

  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span className={cn(textSize, 'font-medium inline-flex items-center gap-1')} style={{ color: `var(${config.token})` }} title={config.desc}>
      {visibility === 'manifest_only' ? <FileText className={iconSize} /> : <Lock className={iconSize} />} {config.label}
    </span>
  );
}

// ── Pricing Model Display ──────────────────────────────────

interface PricingBadgeProps {
  pricingModel?: string;
  price?: number;
  size?: 'xs' | 'sm';
}

export function PricingBadge({ pricingModel, price, size = 'sm' }: PricingBadgeProps) {
  if (!pricingModel || pricingModel === 'free') return null;
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';

  const priceDisplay = price ? `$${(price / 100).toFixed(2)}` : '';
  const modelLabels: Record<string, string> = {
    one_time: 'One-time',
    per_call: 'Per call',
    subscription: 'Subscription',
  };

  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span className={cn(textSize, PILL_CLASS)} style={tintPill('--color-warning')}>
      <CircleDollarSign className={iconSize} /> {priceDisplay} {modelLabels[pricingModel] || pricingModel}
    </span>
  );
}
