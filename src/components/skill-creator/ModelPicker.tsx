// ============================================================
// ModelPicker — model dropdown with health "traffic lights".
// ============================================================
// Replaces the old hard-coded model label in the Skill Executor.
// Shows every selectable model for the active runtime with a
// red/green status dot (probed live against the model's backend).
// Models that don't respond are shown but disabled, so the user
// can see what exists and only pick one that actually works.
//
// Probing is auto-on-open + cached for the session (see
// modelCatalog.ts); a "Re-test" button forces a fresh sweep.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, RotateCcw, Loader2, Check } from 'lucide-react';
import type { ModelConfig } from '../../lib/opencode-client';
import {
  runtimeKind,
  fetchCatalog,
  probeAll,
  cachedHealth,
  toModelConfig,
  staticCatalog,
  type ModelOption,
  type HealthState,
} from '../../lib/modelCatalog';

interface ModelPickerProps {
  /** SkillExecutor RuntimeMode ('cf-cc' | 'cf-ai' | 'opencode'). */
  runtimeMode: string;
  selected: ModelConfig;
  onSelect: (m: ModelConfig) => void;
}

const DOT: Record<HealthState, string> = {
  ok: 'bg-emerald-500',
  down: 'bg-rose-500',
  checking: 'bg-amber-400 animate-pulse',
  unknown: 'bg-foreground/25',
};
const DOT_TITLE: Record<HealthState, string> = {
  ok: 'Online',
  down: 'Not responding',
  checking: 'Testing…',
  unknown: 'Not tested yet',
};

export function ModelPicker({ runtimeMode, selected, onSelect }: ModelPickerProps) {
  const kind = runtimeKind(runtimeMode);
  const [open, setOpen] = useState(false);
  // Authoritative catalogs fetched per runtime; until a fetch lands we render
  // the static fallback. Derived (not setState-in-effect) so the rules-of-hooks
  // lint stays happy and switching runtime never flashes the previous list.
  const [fetchedByKind, setFetchedByKind] = useState<Record<string, ModelOption[]>>({});
  const catalog = fetchedByKind[kind] ?? staticCatalog(kind);
  // Bump to re-read the module-level health cache as probes resolve.
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((n) => n + 1), []);
  const probedKinds = useRef<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  const runProbes = useCallback(
    (cat: ModelOption[]) => {
      probedKinds.current.add(kind);
      void probeAll(kind, cat.map((m) => m.id), rerender);
    },
    [kind, rerender],
  );

  // Fetch the authoritative catalog when the runtime changes. Async-only state
  // update (the static list already shows via the derived `catalog` above).
  useEffect(() => {
    let alive = true;
    fetchCatalog(kind).then((c) => {
      if (alive) setFetchedByKind((prev) => ({ ...prev, [kind]: c }));
    });
    return () => {
      alive = false;
    };
  }, [kind]);

  // Auto-probe the first time the dropdown opens for this runtime.
  useEffect(() => {
    if (open && !probedKinds.current.has(kind)) runProbes(catalog);
  }, [open, kind, catalog, runProbes]);

  // Close on outside-click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectedOpt = catalog.find((m) => m.id === selected.modelID);
  const selLabel = selectedOpt?.label ?? selected.modelID;
  const selHealth = cachedHealth(kind, selected.modelID).state;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-2.5 py-1 text-[11px] font-medium text-foreground-secondary ring-1 ring-border transition-colors hover:bg-foreground/[0.07]"
        title="Choose model"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`h-2 w-2 rounded-full ${DOT[selHealth]}`} title={DOT_TITLE[selHealth]} />
        <span className="max-w-[120px] truncate">{selLabel}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-candy-2 ring-1 ring-black/5"
          role="listbox"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary">
              Model
            </span>
            <button
              type="button"
              onClick={() => runProbes(catalog)}
              className="inline-flex items-center gap-1 text-[11px] text-foreground-tertiary transition-colors hover:text-foreground"
              title="Re-test every model"
            >
              <RotateCcw className="h-3 w-3" /> Re-test
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {catalog.map((opt) => {
              const h = cachedHealth(kind, opt.id);
              const isSel = opt.id === selected.modelID;
              const disabled = h.state === 'down';
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  disabled={disabled}
                  onClick={() => {
                    if (!disabled) {
                      onSelect(toModelConfig(kind, opt));
                      setOpen(false);
                    }
                  }}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                    disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-secondary',
                    isSel ? 'bg-primary/10' : '',
                  ].join(' ')}
                  title={
                    h.state === 'down'
                      ? h.error
                        ? `Unavailable — ${h.error}`
                        : 'Unavailable'
                      : DOT_TITLE[h.state]
                  }
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[h.state]}`} />
                  <span className="flex-1 truncate">
                    <span className="font-medium text-foreground">{opt.label}</span>
                    {opt.note && (
                      <span className="ml-1 text-[10px] text-foreground-tertiary">{opt.note}</span>
                    )}
                  </span>
                  {h.state === 'checking' && (
                    <Loader2 className="h-3 w-3 animate-spin text-foreground-tertiary" />
                  )}
                  {h.state === 'ok' && h.latencyMs != null && (
                    <span className="text-[10px] tabular-nums text-foreground-tertiary">
                      {(h.latencyMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  {h.state === 'down' && <span className="text-[10px] text-rose-500/80">down</span>}
                  {isSel && <Check className="h-3 w-3 text-primary" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[10px] text-foreground-tertiary">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> online
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> down
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/25" /> untested
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
