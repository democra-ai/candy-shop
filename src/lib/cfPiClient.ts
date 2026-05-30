// ============================================================
// Pi runtime client — HTTP-SSE transport.
// ============================================================
// Runs the Pi coding agent (github.com/earendil-works/pi) headless in the
// `pi-sandbox` Cloudflare container worker (`pi -p --mode json`) and streams
// Pi's JSON event output back as SSE. Pi runs KEYLESS — the worker proxies an
// OpenAI-compatible /v1/chat/completions shim to Workers AI, and the container's
// models.json points Pi at it.
//
// We POST DIRECTLY to the worker (not through candy-shop-api) — the worker sets
// permissive CORS, so a browser fetch from candy.democra.ai works without an
// intermediate proxy. Mirrors cfN8nClient's SSE-parse → callbacks shape; the
// event surface:
//
//   phase       { phase: 'setup' | 'run' }
//   setup       { ok, ms, provider, model, shim, skill?, tail }
//   pi-session  { sessionId, cwd, version }
//   stdout      { type: 'text'|'reasoning'|'tool_use'|'tool_result'|'step_start'|'step_finish', ... }
//   run_ms      { ms }
//   result      { success, exitCode, sandboxId, model, text?, diff?, error? }
//   warmed      { ok, ms, pi }            ← only for warm-only pre-boot
//   pi-event    { type, detail? }         ← debug passthrough
//   error       { message, tail? }
//
// Every event payload is JSON (unlike n8n, pi's `stdout` payloads are structured
// objects, not plain text).
// ============================================================

/**
 * Base URL of the pi-sandbox worker. Overridable via VITE_PI_SANDBOX_URL;
 * defaults to the deployed public URL.
 */
const PI_BASE = (
  (import.meta.env.VITE_PI_SANDBOX_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://pi-sandbox.candy-shop.workers.dev'
);

/** A single streamed Pi event, as re-emitted by the worker's `stdout` SSE. */
export interface PiStdoutEvent {
  /** Event kind mirrored from Pi's JSON event stream. */
  type:
    | 'text'
    | 'reasoning'
    | 'tool_use'
    | 'tool_result'
    | 'step_start'
    | 'step_finish'
    | string;
  /** Streamed assistant text / reasoning delta (for `text` / `reasoning`). */
  text?: string;
  /** Tool name (for `tool_use` / `tool_result`). */
  name?: string;
  /** Tool call arguments (for `tool_use`). */
  args?: unknown;
  /** Tool call id correlating start/end. */
  id?: string;
  /** Whether a `tool_result` was an error. */
  isError?: boolean;
  /** Stop reason on `step_finish`. */
  reason?: string;
  timestamp?: number;
}

/** Each callback fires the instant the event lands — render side appends. */
export interface PiStreamCallbacks {
  /** Coarse phase indicator: 'setup' (boot + write models.json) → 'run'. */
  onPhase?: (phase: string, meta?: Record<string, unknown>) => void;
  /** Setup finished (container booted, models.json written, model resolved). */
  onSetup?: (data: Record<string, unknown>) => void;
  /** Pi session header (sessionId / cwd / version). */
  onSession?: (data: { sessionId?: string; cwd?: string; version?: number }) => void;
  /** A streamed Pi event (text delta, tool call, step lifecycle). */
  onStdout?: (event: PiStdoutEvent) => void;
  /** Run finished; `success` reflects Pi's process exit code. `text` is the
   *  accumulated assistant answer; `diff` is the local `git diff` (usually empty
   *  under the read-only smoke allowlist). */
  onResult?: (data: {
    success: boolean;
    exitCode?: number;
    sandboxId?: string;
    model?: string;
    text?: string;
    diff?: string;
    error?: string;
  }) => void;
  /** Any raw event, for debugging / extension. */
  onEvent?: (event: string, data: unknown) => void;
  /** Fatal error (network, non-2xx, or an `error` event from the worker). */
  onError?: (err: Error) => void;
}

/**
 * Best-effort pre-warm of the sandbox container so the first run skips the cold
 * boot (container provision + pi CLI resident + models.json written). Non-fatal;
 * any failure swallowed.
 */
export async function warmPi(): Promise<void> {
  try {
    await fetch(`${PI_BASE}/warm`, { method: 'GET' }).catch(() => {});
  } catch {
    /* best-effort */
  }
}

/**
 * Run one Pi task over HTTP SSE.
 *
 * POSTs {task, skillMd?, fast?} to the worker's /run and parses the SSE stream
 * into the callbacks above. Each call is an independent one-shot `pi -p` run.
 *
 * - `task`    the instruction for the Pi agent (the `pi -p "<task>"` prompt).
 * - `skillMd` optional marketplace SKILL.md appended to Pi's system prompt.
 * - `fast`    use the smaller/faster Workers AI model (llama-3.1-8b) vs 70B.
 */
export async function streamPiRun(
  params: { task: string; skillMd?: string; fast?: boolean },
  cb: PiStreamCallbacks = {},
): Promise<void> {
  const body: Record<string, unknown> = { task: params.task };
  if (params.skillMd) body.skillMd = params.skillMd;
  if (params.fast) body.fast = params.fast;

  let r: Response;
  try {
    r = await fetch(`${PI_BASE}/run`, {
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
    const e = new Error(`Pi Sandbox failed (${r.status}): ${text.slice(0, 200)}`);
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

        // Every pi-sandbox SSE payload is JSON.
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
            cb.onSetup?.(parsed as Record<string, unknown>);
            break;
          case 'pi-session':
            cb.onSession?.(parsed as { sessionId?: string; cwd?: string; version?: number });
            break;
          case 'stdout':
            cb.onStdout?.(parsed as PiStdoutEvent);
            break;
          case 'run_ms':
          case 'warmed':
          case 'pi-event':
            // timing / warm / debug hints — surface via onEvent only
            break;
          case 'result':
            cb.onResult?.(parsed as {
              success: boolean;
              exitCode?: number;
              sandboxId?: string;
              model?: string;
              text?: string;
              diff?: string;
              error?: string;
            });
            break;
          case 'error': {
            const d = parsed as { message?: string; tail?: string };
            const msg = d?.message || 'Pi run failed';
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
