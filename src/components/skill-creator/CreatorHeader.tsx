/**
 * CreatorHeader — the shared section header for the creator flow + library
 * surfaces, matching DESIGN.md §4: optional understated mono eyebrow, a
 * `font-candy` title, and a one-line muted subtitle. Optional back button uses
 * the ghost-link treatment (no chrome-coloured hardcodes).
 */

import { ArrowLeft } from 'lucide-react';

interface CreatorHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Optional right-aligned action (e.g. a Create button). */
  action?: React.ReactNode;
}

export function CreatorHeader({ eyebrow, title, subtitle, onBack, action }: CreatorHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            className="mt-1 inline-flex items-center justify-center w-9 h-9 rounded-full text-foreground-secondary hover:text-foreground hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-tertiary mb-1.5">
              {eyebrow}
            </p>
          )}
          <h1 className="font-candy font-bold tracking-tight leading-[1.1] text-2xl md:text-3xl text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-foreground-secondary font-body">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
