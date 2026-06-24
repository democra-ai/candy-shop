// ============================================================
// Model catalog + health probing for the Skill Executor picker.
// ============================================================
// Each runtime exposes a small set of selectable models:
//   cc (Claude Code) → GLM models on z.ai (probed via /api/cc/health)
//   oc (OpenCode)    → same GLM models (reuses the cc probe)
//   ai (Workers AI)  → Llama models (probed via /api/ai/health)
//
// We probe each model against its live backend so the picker can show
// a red/green "traffic light" and disable the ones that don't respond.
// Probe results are cached for the session (module-level Map) so the
// auto-probe-on-open only spends a probe once per model per session.
// ============================================================

import type { ModelConfig } from './opencode-client';

const API_BASE =
  (import.meta.env.VITE_PAYMENT_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  '/api';

export type RuntimeKind = 'cc' | 'oc' | 'ai';

export interface ModelOption {
  /** Runtime-native model id. cc/oc: "glm-4.5"; ai: "@cf/meta/llama-…". */
  id: string;
  label: string;
  /** OpenCode provider id (cc/oc only). */
  providerID?: string;
  note?: string;
  isDefault?: boolean;
}

export type HealthState = 'unknown' | 'checking' | 'ok' | 'down';

export interface HealthResult {
  state: HealthState;
  latencyMs?: number;
  error?: string;
  /** epoch ms when probed (cache freshness). */
  at?: number;
}

// ── Static fallback catalogs ────────────────────────────────
// The worker /models endpoints are authoritative; these define the
// labels/notes the API may omit and act as the offline/dev fallback.
// Offline/dev fallback only — the worker /models endpoint is authoritative
// (fetchCatalog prefers it). Kept in sync with cc-sandbox's CC_MODELS: just
// the z.ai ids known to be provisioned. The health probe gates pickability,
// so an id that ever stops responding shows red rather than failing a run.
const GLM_MODELS: ModelOption[] = [
  { id: 'glm-4.6',     label: 'GLM-4.6',     providerID: 'zhipuai-coding-plan', note: 'newest' },
  { id: 'glm-4.5',     label: 'GLM-4.5',     providerID: 'zhipuai-coding-plan' },
  { id: 'glm-4.5-air', label: 'GLM-4.5 Air', providerID: 'zhipuai-coding-plan', note: 'fastest', isDefault: true },
  { id: 'glm-4.7',     label: 'GLM-4.7',     providerID: 'zhipuai-coding-plan' },
];

const AI_MODELS: ModelOption[] = [
  { id: '@cf/meta/llama-3.1-8b-instruct-fast',        label: 'Llama 3.1 8B (fast)', note: 'fastest', isDefault: true },
  { id: '@cf/meta/llama-3.1-8b-instruct',             label: 'Llama 3.1 8B' },
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',   label: 'Llama 3.3 70B' },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct',    label: 'Llama 4 Scout 17B' },
];

const STATIC_CATALOG: Record<RuntimeKind, ModelOption[]> = {
  cc: GLM_MODELS,
  oc: GLM_MODELS,
  ai: AI_MODELS,
};

/** Map the SkillExecutor's RuntimeMode string to a catalog kind. */
export function runtimeKind(runtimeMode: string): RuntimeKind {
  if (runtimeMode === 'cf-ai' || runtimeMode === 'pi') return 'ai';
  if (runtimeMode === 'opencode') return 'oc';
  return 'cc'; // cf-cc (default)
}

export function staticCatalog(kind: RuntimeKind): ModelOption[] {
  return STATIC_CATALOG[kind];
}

/** Build the ModelConfig the run paths consume from a picked option. */
export function toModelConfig(kind: RuntimeKind, opt: ModelOption): ModelConfig {
  if (kind === 'ai') return { providerID: 'workers-ai', modelID: opt.id };
  return { providerID: opt.providerID ?? 'zhipuai-coding-plan', modelID: opt.id };
}

/** Health/catalog endpoint kind. oc reuses cc's z.ai probe (same GLM backend). */
function endpointKind(kind: RuntimeKind): 'cc' | 'ai' {
  return kind === 'ai' ? 'ai' : 'cc';
}

// ── Catalog fetch (authoritative, with static fallback) ─────
export async function fetchCatalog(kind: RuntimeKind): Promise<ModelOption[]> {
  const ep = endpointKind(kind);
  try {
    const r = await fetch(`${API_BASE}/${ep}/models`, { credentials: 'include' });
    if (r.ok) {
      const j = (await r.json()) as {
        models?: { id: string; label?: string; note?: string; default?: boolean }[];
      };
      if (Array.isArray(j.models) && j.models.length) {
        const staticById = new Map(STATIC_CATALOG[kind].map((m) => [m.id, m]));
        return j.models.map((m) => ({
          id: m.id,
          label: m.label ?? staticById.get(m.id)?.label ?? m.id,
          note: m.note ?? staticById.get(m.id)?.note,
          providerID:
            staticById.get(m.id)?.providerID ??
            (kind === 'ai' ? undefined : 'zhipuai-coding-plan'),
          isDefault: m.default ?? staticById.get(m.id)?.isDefault,
        }));
      }
    }
  } catch {
    /* fall through to static */
  }
  return STATIC_CATALOG[kind];
}

// ── Health probe with session cache ─────────────────────────
const cache = new Map<string, HealthResult>(); // key: `${kind}:${id}`

export function cachedHealth(kind: RuntimeKind, id: string): HealthResult {
  return cache.get(`${kind}:${id}`) ?? { state: 'unknown' };
}

export async function probeModel(kind: RuntimeKind, id: string): Promise<HealthResult> {
  const key = `${kind}:${id}`;
  cache.set(key, { state: 'checking' });
  const ep = endpointKind(kind);
  const started = Date.now();
  try {
    const r = await fetch(`${API_BASE}/${ep}/health?model=${encodeURIComponent(id)}`, {
      credentials: 'include',
    });
    const latencyMs = Date.now() - started;
    // A non-2xx from the health *endpoint* (route missing, proxy 502, etc.)
    // means we couldn't run the test — NOT that the model is broken. Mark it
    // 'unknown' (grey, still selectable) so a flaky/undeployed probe endpoint
    // never locks the user out of every model. Only an actual ok:false verdict
    // from a 200 response marks the model 'down' (red, blocked).
    if (!r.ok) {
      const res: HealthResult = { state: 'unknown', latencyMs, error: `probe unavailable (HTTP ${r.status})`, at: Date.now() };
      cache.set(key, res);
      return res;
    }
    const j = (await r.json()) as { ok?: boolean; latencyMs?: number; error?: string };
    const res: HealthResult = j.ok
      ? { state: 'ok', latencyMs: j.latencyMs ?? latencyMs, at: Date.now() }
      : { state: 'down', latencyMs: j.latencyMs ?? latencyMs, error: j.error ?? 'no response', at: Date.now() };
    cache.set(key, res);
    return res;
  } catch (e) {
    // Network/transport failure reaching the probe endpoint → can't test →
    // 'unknown', not 'down' (don't block selection on probe-infra failure).
    const res: HealthResult = {
      state: 'unknown',
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : 'probe unavailable',
      at: Date.now(),
    };
    cache.set(key, res);
    return res;
  }
}

/**
 * Probe a whole catalog, updating the cache. Concurrency-limited so the
 * auto-probe doesn't fire every request at once. `onUpdate` fires after
 * each probe so the UI can re-render as lights resolve.
 */
export async function probeAll(
  kind: RuntimeKind,
  ids: string[],
  onUpdate?: () => void,
): Promise<void> {
  const LIMIT = 3;
  let i = 0;
  const worker = async () => {
    while (i < ids.length) {
      const id = ids[i++];
      // Start the probe first — probeModel synchronously marks the model
      // 'checking' in the cache before it awaits — then fire onUpdate so the
      // amber "Testing…" dot actually paints, instead of jumping grey→green/red.
      const p = probeModel(kind, id);
      onUpdate?.();
      await p;
      onUpdate?.();
    }
  };
  await Promise.all(Array.from({ length: Math.min(LIMIT, ids.length) }, worker));
}
