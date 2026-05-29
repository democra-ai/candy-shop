// ============================================================
// n8n runtime client — HTTP-SSE transport.
// ============================================================
// Phase 2b: runs an n8n workflow headless in the `n8n-sandbox` Cloudflare
// container worker (n8n CLI: import:workflow + execute --id --rawOutput) and
// streams node-by-node execution + the run result back as SSE.
//
// We POST DIRECTLY to the worker (not through candy-shop-api) — the worker
// sets permissive CORS, so a browser fetch from candy.democra.ai works without
// an intermediate proxy. Mirrors cfLangGraphClient's SSE-parse → callbacks
// shape; the event surface:
//
//   phase   { phase: 'setup' | 'run' }
//   setup   { ok, ms, source: 'bundled-example' | 'fetched', file, input? }
//   node    { name: "<NodeName> (<type>)" }   ← one per node detected
//   stdout  "<a chunk of n8n run output>"      ← streamed, plain text
//   run_ms  { ms }
//   result  { success, exitCode, sandboxId, result? }  ← result = parsed run JSON
//   error   { message, tail? }
//
// `stdout` payloads are plain text (the worker forwards n8n's stdout/stderr);
// every other event is JSON.
// ============================================================

/**
 * Base URL of the n8n-sandbox worker. Overridable via VITE_N8N_SANDBOX_URL;
 * defaults to the deployed public URL.
 */
const N8N_BASE = (
  (import.meta.env.VITE_N8N_SANDBOX_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://n8n-sandbox.candy-shop.workers.dev'
);

/** Each callback fires the instant the event lands — render side appends. */
export interface N8nStreamCallbacks {
  /** Coarse phase indicator: 'setup' (boot + fetch workflow) → 'run'. */
  onPhase?: (phase: string, meta?: Record<string, unknown>) => void;
  /** Setup finished (workflow resolved / artifact fetched). */
  onSetup?: (data: Record<string, unknown>) => void;
  /** A node was detected in the workflow (name + type). */
  onNode?: (data: { name: string }) => void;
  /** A chunk of streamed run output (stdout/stderr). Append as plain text. */
  onStdout?: (text: string) => void;
  /** Run finished; `success` reflects the n8n process exit code. `result` is
   *  the parsed `--rawOutput` execution JSON when it could be lifted out. */
  onResult?: (data: {
    success: boolean;
    exitCode?: number;
    sandboxId?: string;
    result?: unknown;
  }) => void;
  /** Any raw event, for debugging / extension. */
  onEvent?: (event: string, data: unknown) => void;
  /** Fatal error (network, non-2xx, or an `error` event from the worker). */
  onError?: (err: Error) => void;
}

/**
 * Best-effort pre-warm of the sandbox container so the first run skips the
 * cold boot (container provision + n8n CLI resident). Non-fatal; any failure
 * swallowed.
 */
export async function warmN8n(): Promise<void> {
  try {
    await fetch(`${N8N_BASE}/warm`, { method: 'GET' }).catch(() => {});
  } catch {
    /* best-effort */
  }
}

/**
 * Run one n8n workflow over HTTP SSE.
 *
 * POSTs {artifactUrl, input?} to the worker's /run and parses the SSE stream
 * into the callbacks above. Each call is an independent one-shot run.
 *
 * `artifactUrl` points at an n8n workflow .json (a raw URL). The worker
 * recognises its bundled example markers (and an empty URL) and serves the
 * baked-in no-credential Manual-Trigger workflow so the chain is provable
 * without a live, headless-runnable artifact.
 */
export async function streamN8nRun(
  params: { artifactUrl?: string; input?: string; fresh?: boolean },
  cb: N8nStreamCallbacks = {},
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (params.artifactUrl) body.artifactUrl = params.artifactUrl;
  if (params.input) body.input = params.input;
  if (params.fresh) body.fresh = params.fresh;

  let r: Response;
  try {
    r = await fetch(`${N8N_BASE}/run`, {
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
    const e = new Error(`n8n Sandbox failed (${r.status}): ${text.slice(0, 200)}`);
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

        // `stdout` payloads are plain text (may legitimately be JSON-looking);
        // every other event is JSON. Try to parse, but keep the raw string for
        // stdout so we never mangle n8n's printed output.
        let parsed: unknown = dataStr;
        if (event !== 'stdout') {
          try { parsed = JSON.parse(dataStr); } catch { /* keep raw */ }
        }
        cb.onEvent?.(event, parsed);

        switch (event) {
          case 'phase': {
            const p = parsed as { phase?: string } | string;
            const phase = typeof p === 'string' ? p : (p?.phase ?? '');
            if (phase) cb.onPhase?.(phase, typeof p === 'object' ? (p as Record<string, unknown>) : undefined);
            break;
          }
          case 'setup':
            cb.onSetup?.(parsed as Record<string, unknown>);
            break;
          case 'node':
            cb.onNode?.(parsed as { name: string });
            break;
          case 'stdout':
            cb.onStdout?.(typeof parsed === 'string' ? parsed : String(parsed));
            break;
          case 'run_ms':
            // timing hint — surface via onEvent only
            break;
          case 'result':
            cb.onResult?.(parsed as { success: boolean; exitCode?: number; sandboxId?: string; result?: unknown });
            break;
          case 'error': {
            const d = parsed as { message?: string; tail?: string };
            const msg = d?.message || 'n8n run failed';
            const err = new Error(d?.tail ? `${msg}\n${d.tail}` : msg);
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
