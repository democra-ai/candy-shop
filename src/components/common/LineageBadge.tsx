import { cn } from '../../utils/cn';
import type { SkillLineage, ExecutionModel, ManifestVisibility } from '../../data/skillsData';

// ── Lineage Badge ──────────────────────────────────────────
// Shows the provenance of a skill: original, fork, remix, or licensed derivative

const LINEAGE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  original:            { label: 'Original',              color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: '✦' },
  fork:                { label: 'Fork',                  color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',         icon: '⑂' },
  remix:               { label: 'Remix',                 color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',   icon: '♻' },
  licensed_derivative: { label: 'Licensed Derivative',   color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',     icon: '©' },
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

  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn(
        textSize, 'font-semibold px-1.5 py-0.5 rounded-full border font-mono inline-flex items-center gap-0.5',
        config.color,
      )}>
        {config.icon} {config.label}
      </span>
      {showCanonical && lineage.canonical && (
        <span className={cn(
          textSize, 'font-semibold px-1.5 py-0.5 rounded-full border font-mono',
          'bg-rose-500/10 text-rose-500 border-rose-500/20'
        )}>
          ★ Canonical
        </span>
      )}
    </span>
  );
}

// ── Execution Model Badge ──────────────────────────────────

const EXEC_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  open:      { label: 'Open',      color: 'text-emerald-500', desc: 'Self-hostable, run anywhere' },
  managed:   { label: 'Managed',   color: 'text-blue-500',    desc: 'Runs on our infrastructure' },
  federated: { label: 'Federated', color: 'text-purple-500',  desc: 'Creator-hosted execution' },
};

interface ExecutionModelBadgeProps {
  model?: ExecutionModel;
  size?: 'xs' | 'sm';
}

export function ExecutionModelBadge({ model, size = 'sm' }: ExecutionModelBadgeProps) {
  if (!model || model === 'open') return null;
  const config = EXEC_CONFIG[model];
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';

  return (
    <span className={cn(textSize, 'font-medium', config.color)} title={config.desc}>
      {model === 'managed' ? '☁' : '🔗'} {config.label}
    </span>
  );
}

// ── Manifest Visibility Indicator ──────────────────────────

const VIS_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  full:          { label: 'Full Access',     color: 'text-emerald-500', desc: 'Manifest and runtime fully visible' },
  manifest_only: { label: 'Manifest Only',  color: 'text-amber-500',   desc: 'Manifest visible, runtime gated' },
  private:       { label: 'Private',         color: 'text-red-500',     desc: 'Access requires entitlement' },
};

interface ManifestVisibilityBadgeProps {
  visibility?: ManifestVisibility;
  size?: 'xs' | 'sm';
}

export function ManifestVisibilityBadge({ visibility, size = 'sm' }: ManifestVisibilityBadgeProps) {
  if (!visibility || visibility === 'full') return null;
  const config = VIS_CONFIG[visibility];
  const textSize = size === 'xs' ? 'text-[9px]' : 'text-[10px]';

  return (
    <span className={cn(textSize, 'font-medium', config.color)} title={config.desc}>
      {visibility === 'manifest_only' ? '📋' : '🔒'} {config.label}
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

  return (
    <span className={cn(
      textSize, 'font-semibold px-1.5 py-0.5 rounded-full border font-mono inline-flex items-center gap-0.5',
      'bg-amber-500/10 text-amber-500 border-amber-500/20'
    )}>
      💰 {priceDisplay} {modelLabels[pricingModel] || pricingModel}
    </span>
  );
}
