// ============================================================
// AuditBadges + EditorChoiceBadge
// ============================================================
// Renders Gen / Socket / Snyk audit status as compact pills.
// Color: green=pass, yellow=warn, red=fail. Skipped if no audit.
// Editor's Choice is a gold pill rendered alongside.
// ============================================================

import { Award, Shield, ShieldAlert, ShieldX, ShieldCheck } from 'lucide-react';
import { cn } from '../../utils/cn';

const PROVIDERS = [
  { key: 'gen', label: 'Gen' },
  { key: 'socket', label: 'Socket' },
  { key: 'snyk', label: 'Snyk' },
] as const;

export interface AuditSummary {
  pass: number;
  warn: number;
  fail: number;
  max_risk: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
}

/**
 * Compact audit pill row. Shows ONE pill summarizing the worst status
 * across all three providers, plus a count.
 *
 *   Safe        — all 3 pass
 *   Warn (1)    — at least one warn, no fails
 *   Fail (1+)   — at least one fail
 */
export function AuditPillCompact({ summary, size = 'sm' }: { summary: AuditSummary | null | undefined; size?: 'xs' | 'sm' }) {
  if (!summary || summary.pass + summary.warn + summary.fail === 0) return null;
  const worst: 'pass' | 'warn' | 'fail' =
    summary.fail > 0 ? 'fail' : summary.warn > 0 ? 'warn' : 'pass';
  const tone =
    worst === 'pass'
      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
      : worst === 'warn'
        ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
        : 'bg-red-500/15 border-red-500/30 text-red-300';
  const Icon = worst === 'pass' ? ShieldCheck : worst === 'warn' ? ShieldAlert : ShieldX;
  const total = summary.pass + summary.warn + summary.fail;
  const label =
    worst === 'pass'
      ? `Safe · ${total}/${total}`
      : worst === 'warn'
        ? `Warn · ${summary.warn}/${total}`
        : `Fail · ${summary.fail}/${total}`;
  const dim = size === 'xs' ? 'px-1.5 py-0.5 text-[10px] gap-1' : 'px-2 py-0.5 text-xs gap-1.5';
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono rounded-md border whitespace-nowrap',
        dim,
        tone
      )}
      title={`Audits: ${summary.pass} pass, ${summary.warn} warn, ${summary.fail} fail (max risk: ${summary.max_risk || 'n/a'})`}
    >
      <Icon className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {label}
    </span>
  );
}

/**
 * Full row of three audit badges (Gen / Socket / Snyk) used on detail pages.
 * Each badge shows its own status if known, or grey if no audit exists.
 *
 * `audits` is the full audit array from /api/skills/:id.
 */
export interface AuditEntry {
  provider: string;
  provider_slug: string;
  status: 'pass' | 'warn' | 'fail';
  risk_level: string | null;
  summary?: string | null;
}

export function AuditBadgeRow({ audits }: { audits: AuditEntry[] | undefined }) {
  if (!audits) return null;
  const bySlug: Record<string, AuditEntry | undefined> = {};
  for (const a of audits) {
    // Map possible slug variants to a canonical key
    const k = a.provider_slug.toLowerCase();
    if (k.includes('trust') || k.includes('gen') || k === 'agent-trust-hub') bySlug.gen = a;
    else if (k.includes('socket')) bySlug.socket = a;
    else if (k.includes('snyk')) bySlug.snyk = a;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PROVIDERS.map((p) => {
        const a = bySlug[p.key];
        if (!a) {
          return (
            <span
              key={p.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-md border border-border bg-secondary/30 text-foreground-tertiary"
              title={`${p.label}: no audit on record`}
            >
              <Shield className="w-3 h-3 opacity-40" />
              {p.label}
              <span className="opacity-50">—</span>
            </span>
          );
        }
        const tone =
          a.status === 'pass'
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : a.status === 'warn'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'bg-red-500/15 border-red-500/30 text-red-300';
        const Icon = a.status === 'pass' ? ShieldCheck : a.status === 'warn' ? ShieldAlert : ShieldX;
        const labelTxt =
          a.status === 'pass' ? 'Safe' : a.status === 'warn' ? a.risk_level || 'Warn' : a.risk_level || 'Fail';
        return (
          <span
            key={p.key}
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded-md border whitespace-nowrap',
              tone
            )}
            title={a.summary ?? `${p.label}: ${a.status} (${a.risk_level || 'n/a'})`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="opacity-70">{p.label}</span>
            <span className="font-semibold">{labelTxt}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Gold Editor's Choice pill. Renders only when `on` is true. */
export function EditorChoiceBadge({
  on,
  reason,
  size = 'sm',
}: {
  on?: boolean | 0 | 1;
  reason?: string | null;
  size?: 'xs' | 'sm';
}) {
  if (!on) return null;
  const tooltip =
    reason === 'official_org'
      ? "Editor's Choice — published by a vendor-verified org on skills.sh/official"
      : reason === 'seed_repo'
        ? "Editor's Choice — hand-curated by Candy Shop"
        : reason === 'manual'
          ? "Editor's Choice — staff pick"
          : "Editor's Choice";
  const dim = size === 'xs' ? 'px-1.5 py-0.5 text-[10px] gap-1' : 'px-2 py-0.5 text-xs gap-1.5';
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono rounded-md border whitespace-nowrap',
        'bg-amber-500/15 border-amber-500/40 text-amber-300',
        dim
      )}
      title={tooltip}
    >
      <Award className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      Editor's Choice
    </span>
  );
}
