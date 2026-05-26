import { useState } from 'react';
import { cn } from '../../utils/cn';
import type { SkillLineage, ExecutionModel, ManifestVisibility, TeeAttestation } from '../../data/skillsData';

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

const EXEC_CONFIG: Record<string, { label: string; color: string; desc: string; icon: string }> = {
  open:      { label: 'Open',         color: 'text-emerald-500', desc: 'Self-hostable, run anywhere',                        icon: '⟁' },
  managed:   { label: 'Managed',      color: 'text-blue-500',    desc: 'Runs on our infrastructure',                         icon: '☁' },
  tee:       { label: 'TEE Verified', color: 'text-fuchsia-500', desc: 'Confidential execution — prompt hidden from everyone', icon: '🛡' },
  federated: { label: 'Federated',    color: 'text-purple-500',  desc: 'Creator-hosted execution',                           icon: '🔗' },
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
    <span className={cn(textSize, 'font-medium inline-flex items-center gap-1', config.color)} title={config.desc}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

// ── TEE Verified Badge (clickable → attestation modal) ─────
// Tier-2 differentiator: shows a provable "no one can see the prompt"
// claim. Click to inspect the latest attestation document.

interface TeeVerifiedBadgeProps {
  tee?: TeeAttestation;
  size?: 'xs' | 'sm' | 'md';
}

export function TeeVerifiedBadge({ tee, size = 'sm' }: TeeVerifiedBadgeProps) {
  const [open, setOpen] = useState(false);
  if (!tee) return null;

  const textSize = size === 'xs' ? 'text-[9px]' : size === 'md' ? 'text-xs' : 'text-[10px]';
  const providerLabel = PROVIDER_LABEL[tee.provider] || tee.provider;
  const short = (h: string) => h && h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          textSize,
          'font-semibold px-2 py-0.5 rounded-full border font-mono inline-flex items-center gap-1',
          'bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20',
          'hover:bg-fuchsia-500/20 transition-colors cursor-pointer',
        )}
        title="Click to verify attestation"
      >
        🛡 TEE Verified · {providerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background border rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🛡</span>
              <h3 className="text-lg font-semibold">TEE Attestation</h3>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              This skill runs inside a Trusted Execution Environment. Neither the platform nor the
              underlying cloud provider can read the prompt or intermediate data. The attestation
              below cryptographically proves which code is running.
            </p>

            <div className="space-y-3 font-mono text-xs">
              <Row label="Provider" value={providerLabel} />
              <Row label="Code hash" value={short(tee.codeHash)} mono copy={tee.codeHash} />
              {tee.latestAttestation && (
                <>
                  <Row label="Attestation ID" value={short(tee.latestAttestation.id)} mono copy={tee.latestAttestation.id} />
                  <Row label="Verified at" value={new Date(tee.latestAttestation.verifiedAt).toLocaleString()} />
                </>
              )}
              {tee.lastVerifiedAt && !tee.latestAttestation && (
                <Row label="Last verified" value={new Date(tee.lastVerifiedAt).toLocaleString()} />
              )}
              {tee.attestationUrl && (
                <a
                  href={tee.attestationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-fuchsia-500 hover:underline pt-2"
                >
                  View full attestation document ↗
                </a>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 w-full py-2 text-sm rounded-lg border hover:bg-accent transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const PROVIDER_LABEL: Record<string, string> = {
  'phala': 'Phala Cloud',
  'aws-nitro': 'AWS Nitro Enclaves',
  'gcp-cs': 'GCP Confidential Space',
  'azure-cc': 'Azure Confidential Computing',
  'oasis': 'Oasis Network',
};

function Row({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-right truncate', mono && 'font-mono')}>
        {value}
        {copy && (
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(copy)}
            className="ml-2 text-muted-foreground hover:text-foreground"
            title="Copy"
          >
            ⎘
          </button>
        )}
      </span>
    </div>
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
