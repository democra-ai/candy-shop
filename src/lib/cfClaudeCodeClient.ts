// ============================================================
// Cloudflare Sandbox-hosted Claude Code client.
// ============================================================
// POSTs {repo, task} to our Worker's /api/cc/run, which proxies to
// cc-sandbox.candy-shop.workers.dev. The upstream streams SSE events
// in two layers:
//
//   Outer envelope from cc-sandbox:
//     event: phase            // {phase: "restore" | "setup" | "claude"}
//     event: restore          // {ok, ms, id}
//     event: setup            // {ok, ms, exitCode, tail}
//     event: stdout           // {type, ...}   ← Claude Code stream
//     event: phase            // ...
//
//   The "stdout" event is itself a Claude Code stream-event message:
//     {type: "stream_event", event: {type: "message_start", ...}}
//     {type: "stream_event", event: {type: "content_block_delta",
//                                    delta: {type: "text_delta", text: "..."}}}
//     {type: "stream_event", event: {type: "content_block_delta",
//                                    delta: {type: "thinking_delta", ...}}}
//     ...
//     {type: "result", subtype: "success", ...}
//
// We surface only the assistant's TEXT output (text_delta) to the UI,
// plus a small "phase" hint shown while the sandbox is warming up.
// ============================================================

const API_BASE =
  (import.meta.env.VITE_PAYMENT_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  '/api';

export interface CCBudget {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  upstream: string;
  resets_in_seconds: number;
}

export interface CCStreamCallbacks {
  /** "restore" | "setup" | "claude" — coarse-grained sandbox progress. */
  onPhase?: (phase: string) => void;
  /** Called once per text_delta with the new chunk. Append it. */
  onTextDelta?: (delta: string) => void;
  /** Called when the sandbox emits a thinking_delta (optional, can ignore). */
  onThinkingDelta?: (delta: string) => void;
  /** Called once per cc-sandbox top-level event (debug / advanced UI). */
  onEvent?: (event: string, data: unknown) => void;
  /** Called when the upstream sends a final "result" message. */
  onDone?: (result: { success: boolean; durationMs?: number }) => void;
  /** Called on any I/O failure or non-2xx response. */
  onError?: (err: Error) => void;
}

/** Fetch current daily run budget for the calling session. */
export async function getCCBudget(): Promise<CCBudget | null> {
  try {
    const r = await fetch(`${API_BASE}/cc/budget`, { credentials: 'include' });
    if (!r.ok) return null;
    return await r.json() as CCBudget;
  } catch {
    return null;
  }
}

/** Streams a Claude Code Sandbox run; returns the final assembled text. */
export async function streamClaudeCodeRun(
  params: { repo: string; task: string },
  cb: CCStreamCallbacks = {},
): Promise<string> {
  const r = await fetch(`${API_BASE}/cc/run`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (r.status === 429) {
    const j = await r.json().catch(() => ({})) as { message?: string };
    const e = new Error(j.message || 'Daily Claude Code Sandbox limit reached.');
    cb.onError?.(e);
    throw e;
  }
  if (!r.ok || !r.body) {
    const body = await r.text().catch(() => '');
    const e = new Error(`Claude Code Sandbox failed (${r.status}): ${body.slice(0, 200)}`);
    cb.onError?.(e);
    throw e;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let collected = '';
  let done = false;

  while (!done) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });

    // Each SSE message ends with \n\n
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data = data ? data + '\n' + line.slice(6) : line.slice(6);
      }

      let parsed: any = data;
      try { parsed = JSON.parse(data); } catch { /* keep as string */ }

      cb.onEvent?.(event, parsed);

      if (event === 'phase' && parsed?.phase) {
        cb.onPhase?.(parsed.phase);
      } else if (event === 'stdout' && parsed?.type === 'stream_event') {
        const innerType = parsed.event?.type;
        const delta = parsed.event?.delta;
        if (innerType === 'content_block_delta' && delta?.type === 'text_delta' && delta.text) {
          collected += delta.text;
          cb.onTextDelta?.(delta.text);
        } else if (innerType === 'content_block_delta' && delta?.type === 'thinking_delta' && delta.thinking) {
          cb.onThinkingDelta?.(delta.thinking);
        }
      } else if (event === 'stdout' && parsed?.type === 'result') {
        done = true;
        cb.onDone?.({
          success: parsed.subtype === 'success',
          durationMs: parsed.duration_ms,
        });
      }
    }
  }

  if (!done) cb.onDone?.({ success: true });
  return collected;
}

/**
 * Best-effort: derive a github.com repo URL from a skill's `skillMdUrl`.
 * Skills typically reference `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`.
 * Returns the repo's HTTPS clone URL, or `null` if we can't tell.
 */
export function deriveRepoUrlFromSkillMd(skillMdUrl: string | undefined): string | null {
  if (!skillMdUrl) return null;
  const m = skillMdUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\//);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}
