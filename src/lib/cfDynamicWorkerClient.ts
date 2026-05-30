// ============================================================
// Dynamic Worker (dw-sandbox) runtime client — HTTP-SSE transport.
// ============================================================
// Runs arbitrary JS/TS Worker modules on the fly in the `dw-sandbox`
// Cloudflare Worker, which loads them via the Worker Loader (Dynamic Workers)
// binding (`env.LOADER`) and streams the run back as SSE. dw-sandbox is a PLAIN
// worker — no container, no Durable Object.
//
// We POST DIRECTLY to the worker (not through candy-shop-api) — the worker sets
// permissive CORS, so a browser fetch from candy.democra.ai works without an
// intermediate proxy. Mirrors cfN8nClient's SSE-parse → callbacks shape.
//
// Event surface (from dw-sandbox /run):
//
//   phase    { phase: 'setup' | 'run' }
//   setup    { ok, ms, source, mainModule, bytes, hash, mode, input }
//   log      { stream: 'stdout' | 'stderr', text }   ← streamed run log lines
//   run_ms   { ms }
//   result   { success, status, hash, mainModule, result?, raw? }
//   error    { message }
//
// Every event payload is JSON (unlike cf-n8n, dw-sandbox emits structured
// `log` events rather than raw-text `stdout`).
//
// LIVE STATUS: dw-sandbox is DEPLOYED and the Worker Loader executes dynamic
// modules in production on this account — DW_RUN_URL points at the live worker.
// (Worker Loader deploys are CLOSED BETA in general; this account is enrolled.
// Without enrollment, deploys are rejected and you must run dw-sandbox locally
// via `wrangler dev` — see LOCAL_DEV_URL below.)
// ============================================================

/**
 * Deployed public origin of the dw-sandbox worker. Worker Loader executes
 * dynamic modules here in production (account is closed-beta enrolled).
 */
export const DW_RUN_URL = 'https://dw-sandbox.candy-shop.workers.dev';

/**
 * Local-dev fallback origin. If your Cloudflare account is NOT enrolled in the
 * Worker Loader (Dynamic Workers) closed beta, `wrangler deploy` is rejected and
 * dw-sandbox must run locally:
 *
 *   cd cf-dynamic-worker && npx wrangler dev --port 8799
 *
 * Then set VITE_DW_SANDBOX_URL to this value. Local dev / workerd runs the
 * Worker Loader WITHOUT beta enrollment.
 */
export const LOCAL_DEV_URL = 'http://127.0.0.1:8799';

/**
 * Base URL of the dw-sandbox worker. Overridable via VITE_DW_SANDBOX_URL;
 * defaults to the deployed public URL (DW_RUN_URL).
 */
const DW_BASE = (
  (import.meta.env.VITE_DW_SANDBOX_URL as string | undefined)?.replace(/\/+$/, '') ||
  DW_RUN_URL
);

/** Each callback fires the instant the event lands — render side appends. */
export interface DynamicWorkerStreamCallbacks {
  /** Coarse phase indicator: 'setup' (resolve source) → 'run' (invoke module). */
  onPhase?: (phase: string, meta?: Record<string, unknown>) => void;
  /** Setup finished — module source resolved (inline / bundled / fetched). */
  onSetup?: (data: {
    ok: boolean;
    ms?: number;
    source?: string;
    mainModule?: string;
    bytes?: number;
    hash?: string;
    mode?: string;
    input?: unknown;
  }) => void;
  /** A streamed run-log line from the host (module invocation progress). */
  onLog?: (data: { stream: string; text: string }) => void;
  /** Run finished; `success` reflects the loaded module's HTTP status. `result`
   *  is the parsed JSON the module returned (or `raw` text if non-JSON). */
  onResult?: (data: {
    success: boolean;
    status?: number;
    hash?: string;
    mainModule?: string;
    result?: unknown;
    raw?: string;
  }) => void;
  /** Any raw event, for debugging / extension. */
  onEvent?: (event: string, data: unknown) => void;
  /** Fatal error (network, non-2xx, or an `error` event from the worker). */
  onError?: (err: Error) => void;
}

/** Params for a single dynamic-worker run. */
export interface DynamicWorkerRunParams {
  /** Inline module source — a full Worker `export default { async fetch() }`. */
  code?: string;
  /** Raw URL of a module artifact to fetch as the source instead of `code`.
   *  Empty or an example-marker URL resolves to the bundled transform-tool. */
  artifactUrl?: string;
  /** Module filename for the loader's mainModule (default "main.js"). */
  mainModule?: string;
  /** JSON value forwarded to the loaded module's fetch as the request body. */
  input?: unknown;
  /** Force a fresh, uncached load (env.LOADER.load) instead of get(hash). */
  fresh?: boolean;
}

/**
 * Best-effort pre-warm: hits /warm, which loads + invokes the bundled example
 * through the Worker Loader so the binding path is hot before the first run.
 * Non-fatal; any failure swallowed.
 */
export async function warmDynamicWorker(): Promise<void> {
  try {
    await fetch(`${DW_BASE}/warm`, { method: 'GET' }).catch(() => {});
  } catch {
    /* best-effort */
  }
}

/**
 * Run one dynamic Worker module over HTTP SSE.
 *
 * POSTs {code?, artifactUrl?, mainModule?, input?, fresh?} to dw-sandbox's /run
 * and parses the SSE stream into the callbacks above. Each call is an
 * independent one-shot run; the loaded module executes in an isolated child
 * Worker (globalOutbound: null — no network egress).
 *
 * Provide EITHER `code` (inline source) OR `artifactUrl` (a raw module URL).
 * An empty/omitted artifactUrl (and no code) resolves to the bundled
 * transform-tool example so the chain is provable without a live artifact.
 */
export async function streamDynamicWorkerRun(
  params: DynamicWorkerRunParams,
  cb: DynamicWorkerStreamCallbacks = {},
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (params.code) body.code = params.code;
  if (params.artifactUrl) body.artifactUrl = params.artifactUrl;
  if (params.mainModule) body.mainModule = params.mainModule;
  if (params.input !== undefined) body.input = params.input;
  if (params.fresh) body.fresh = params.fresh;

  let r: Response;
  try {
    r = await fetch(`${DW_BASE}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    cb.onError?.(err);
    throw err;
  }

  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => '');
    const e = new Error(`dw-sandbox failed (${r.status}): ${text.slice(0, 200)}`);
    cb.onError?.(e);
    throw e;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        let event = 'message';
        let dataStr = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) event = line.slice(7).trim();
          else if (line.startsWith('data: '))
            dataStr = dataStr ? dataStr + '\n' + line.slice(6) : line.slice(6);
        }
        if (!dataStr) continue;

        // Every dw-sandbox event payload is JSON.
        let parsed: unknown = dataStr;
        try { parsed = JSON.parse(dataStr); } catch { /* keep raw */ }
        cb.onEvent?.(event, parsed);

        switch (event) {
          case 'phase': {
            const p = parsed as { phase?: string } | string;
            const phase = typeof p === 'string' ? p : (p?.phase ?? '');
            if (phase) cb.onPhase?.(phase, typeof p === 'object' ? (p as Record<string, unknown>) : undefined);
            break;
          }
          case 'setup':
            cb.onSetup?.(parsed as Parameters<NonNullable<DynamicWorkerStreamCallbacks['onSetup']>>[0]);
            break;
          case 'log':
            cb.onLog?.(parsed as { stream: string; text: string });
            break;
          case 'run_ms':
            // timing hint — surface via onEvent only
            break;
          case 'result':
            cb.onResult?.(parsed as Parameters<NonNullable<DynamicWorkerStreamCallbacks['onResult']>>[0]);
            break;
          case 'error': {
            const d = parsed as { message?: string };
            const err = new Error(d?.message || 'dw-sandbox run failed');
            cb.onError?.(err);
            throw err;
          }
          default:
            break;
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}
