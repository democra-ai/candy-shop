// ============================================================
// LangGraph runtime client — HTTP-SSE transport.
// ============================================================
// Phase 2a: runs a LangGraph/LangChain graph in the `langgraph-sandbox`
// Cloudflare container worker and streams its output back as SSE.
//
// We POST DIRECTLY to the worker (not through candy-shop-api) — the worker
// sets permissive CORS, so a browser fetch from candy.democra.ai works without
// an intermediate proxy. This mirrors the SSE-parse → callbacks shape of
// cfClaudeCodeClient, but the event surface is much smaller:
//
//   Outer envelope events:
//     phase   { phase: 'setup' | 'run', model? }
//     setup   { ok, ms, source: 'bundled-example' | 'fetched', ... }
//     stdout  "<a chunk of human-readable graph output>"   (streamed steps)
//     run_ms  { ms }
//     result  { success, exitCode, sandboxId }
//     error   { message, tail? }
//
// The worker forwards both the graph's stdout AND stderr as `stdout` events so
// the UI just appends the text — no claude block-parser needed.
// ============================================================

/**
 * Base URL of the langgraph-sandbox worker. Overridable via
 * VITE_LANGGRAPH_SANDBOX_URL; defaults to the deployed public URL.
 */
const LANGGRAPH_BASE = (
  (import.meta.env.VITE_LANGGRAPH_SANDBOX_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://langgraph-sandbox.candy-shop.workers.dev'
);

/** Each callback fires the instant the event lands — render side appends. */
export interface LangGraphStreamCallbacks {
  /** Coarse phase indicator: 'setup' (boot + resolve graph) → 'run'. */
  onPhase?: (phase: string, meta?: Record<string, unknown>) => void;
  /** A chunk of streamed graph output (stdout/stderr). Append as plain text. */
  onStdout?: (text: string) => void;
  /** Setup finished (graph resolved / artifact fetched). */
  onSetup?: (data: Record<string, unknown>) => void;
  /** Graph run finished; `success` reflects the process exit code. */
  onResult?: (data: { success: boolean; exitCode?: number; sandboxId?: string }) => void;
  /** Any raw event, for debugging / extension. */
  onEvent?: (event: string, data: unknown) => void;
  /** Fatal error (network, non-2xx, or an `error` event from the worker). */
  onError?: (err: Error) => void;
}

/**
 * Best-effort pre-warm of the sandbox container so the first run skips the
 * cold boot (~10–30s container provision). Non-fatal; any failure swallowed.
 */
export async function warmLangGraph(): Promise<void> {
  try {
    await fetch(`${LANGGRAPH_BASE}/warm`, { method: 'GET' }).catch(() => {});
  } catch {
    /* best-effort */
  }
}

/**
 * Run one LangGraph graph over HTTP SSE.
 *
 * POSTs {artifactUrl, task} to the worker's /run and parses the SSE stream into
 * the callbacks above. Each call is an independent one-shot run.
 *
 * `artifactUrl` points at the graph artifact (a langgraph.json, a single
 * graph.py, or one of the seed example GitHub URLs the worker recognises and
 * serves from its bundled example). `task` is the first user message.
 */
export async function streamLangGraphRun(
  params: { artifactUrl?: string; task: string; fresh?: boolean },
  cb: LangGraphStreamCallbacks = {},
): Promise<void> {
  const body: Record<string, unknown> = { task: params.task };
  if (params.artifactUrl) body.artifactUrl = params.artifactUrl;
  if (params.fresh) body.fresh = params.fresh;

  let r: Response;
  try {
    r = await fetch(`${LANGGRAPH_BASE}/run`, {
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
    const e = new Error(`LangGraph Sandbox failed (${r.status}): ${text.slice(0, 200)}`);
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
        // stdout so we never mangle the graph's printed output.
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
          case 'stdout':
            cb.onStdout?.(typeof parsed === 'string' ? parsed : String(parsed));
            break;
          case 'run_ms':
            // timing hint — surface via onEvent only
            break;
          case 'result':
            cb.onResult?.(parsed as { success: boolean; exitCode?: number; sandboxId?: string });
            break;
          case 'error': {
            const d = parsed as { message?: string; tail?: string };
            const msg = d?.message || 'LangGraph run failed';
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
