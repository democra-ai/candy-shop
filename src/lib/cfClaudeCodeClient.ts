// ============================================================
// Claude Code agent client — HTTP-SSE transport (/api/cc/run).
// ============================================================
// Transport history:
//   * The original client POSTed {repo, task, skillMd} to the Worker's
//     /api/cc/run and read a streaming SSE response — one shot per turn.
//   * A migration swapped this for a ticket + persistent WebSocket model
//     (/api/cc/ticket → wss://agent/ws). That backend was never deployed:
//     /api/cc/ticket returns 404 and the agent worker has no /ws, so every
//     turn failed at the mint step (404 → nothing streams).
//   * This file reverts the transport back to HTTP-SSE /api/cc/run, which
//     is live and healthy, while keeping the SAME exported surface so the
//     SkillExecutor UI needs no change.
//
// Two layers of SSE on /api/cc/run:
//
//   Outer envelope:   phase / restore / setup / claude_ttfo / claude_ms /
//                     snapshot / diff / done / stall-warning
//
//   stdout payloads (Claude Code stream-json format):
//     system/init                     — env, available tools, model
//     stream_event/content_block_start
//                                     - type:text                 ← assistant text begins
//                                     - type:thinking             ← reasoning begins
//                                     - type:tool_use {name,id}   ← tool call begins
//     stream_event/content_block_delta
//                                     - text_delta                ← TOKEN-BY-TOKEN text
//                                     - thinking_delta            ← TOKEN-BY-TOKEN thinking
//                                     - input_json_delta          ← tool args streamed
//     stream_event/content_block_stop
//     user                            — tool_result blocks
//     assistant                       — completed assistant message
//     result/success                  — final summary
//
// The public API (streamClaudeCodeRun / CCStreamCallbacks / getCCBudget /
// warmClaudeAgent / resetClaudeSession / deriveRepoUrlFromSkillMd) is
// unchanged, so the SkillExecutor UI keeps working — only the transport
// changed (WebSocket → HTTP SSE).
// ============================================================

const API_BASE =
  (import.meta.env.VITE_PAYMENT_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  '/api';

export interface CCBudget {
  date: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  upstream: string;
  resets_in_seconds: number;
}

/** Each callback fires the instant the event lands — render side appends. */
export interface CCStreamCallbacks {
  onPhase?: (phase: string) => void;
  onSandboxEvent?: (
    event:
      | 'restore' | 'setup' | 'snapshot' | 'diff'
      | 'claude_ms' | 'claude_ttfo' | 'done' | 'stall-warning',
    data: Record<string, unknown>,
  ) => void;
  onSystemInit?: (info: { model?: string; tools?: string[]; cwd?: string }) => void;
  onBlockStart?: (block: {
    type: 'text' | 'thinking' | 'tool_use';
    index: number;
    tool?: { name: string; id: string };
  }) => void;
  onTextDelta?: (delta: string, blockIndex: number) => void;
  onThinkingDelta?: (delta: string, blockIndex: number) => void;
  onToolInputDelta?: (partialJson: string, blockIndex: number) => void;
  onBlockStop?: (blockIndex: number) => void;
  onToolResult?: (result: { toolUseId: string; content: string; isError?: boolean }) => void;
  onAssistantFinal?: (text: string) => void;
  onResult?: (result: { success: boolean; durationMs?: number; usage?: unknown }) => void;
  onEvent?: (event: string, data: unknown) => void;
  onError?: (err: Error) => void;
}

export async function getCCBudget(): Promise<CCBudget | null> {
  try {
    const r = await fetch(`${API_BASE}/cc/budget`, { credentials: 'include' });
    if (!r.ok) return null;
    return (await r.json()) as CCBudget;
  } catch {
    return null;
  }
}

/**
 * Best-effort pre-warm. The /api/cc/run backend keeps its sandbox warm via
 * its own cron, so there is no separate warm endpoint to hit in the HTTP-SSE
 * model. We keep this exported (SkillExecutor calls it on mount) and make it
 * a cheap, non-fatal touch of the budget endpoint so the connection/auth is
 * primed; any failure is swallowed.
 */
export async function warmClaudeAgent(_skill?: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/cc/budget`, { credentials: 'include' }).catch(() => {});
  } catch {
    /* best-effort */
  }
}

/**
 * No-op in the HTTP-SSE model: each /api/cc/run call is an independent
 * one-shot turn, so there is no persistent session to reset. Kept exported
 * for API compatibility (SkillExecutor / future callers import it).
 */
export function resetClaudeSession(): void {
  /* no persistent session to reset in HTTP-SSE mode */
}

/**
 * Run one turn against the Claude Code sandbox over HTTP SSE.
 *
 * POSTs to /api/cc/run and parses the two-layer SSE stream into the existing
 * CCStreamCallbacks the SkillExecutor UI already renders. Each call is a
 * fresh one-shot run (no multi-turn session state on the client side).
 *
 * `repo` is forwarded; empty/undefined means the sandbox uses its pre-baked
 * scratch workspace (fastest TTFR). The skill body is delivered via `skillMd`.
 */
export async function streamClaudeCodeRun(
  params: { task: string; repo?: string; skillMd?: string; model?: string; fast?: boolean; fresh?: boolean },
  cb: CCStreamCallbacks = {},
): Promise<void> {
  // Forward exactly the fields the /api/cc/run backend understands. Default
  // `fast` on (matches the verified-fast streaming path) unless the caller
  // explicitly set it.
  const body: Record<string, unknown> = {
    task: params.task,
    fast: params.fast ?? true,
  };
  if (params.repo) body.repo = params.repo;
  if (params.skillMd) body.skillMd = params.skillMd;
  if (params.model) body.model = params.model;
  if (params.fresh) body.fresh = params.fresh;

  let r: Response;
  try {
    r = await fetch(`${API_BASE}/cc/run`, {
      method: 'POST',
      credentials: 'include',
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
    const e = new Error(`Claude Code Sandbox failed (${r.status}): ${text.slice(0, 200)}`);
    cb.onError?.(e);
    throw e;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const startedAt = Date.now();
  let firstOutput = false;

  const markFirstOutput = () => {
    if (!firstOutput) {
      firstOutput = true;
      cb.onSandboxEvent?.('claude_ttfo', { ms: Date.now() - startedAt });
    }
  };

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

        let parsed: any = dataStr;
        try { parsed = JSON.parse(dataStr); } catch { /* keep raw string */ }
        cb.onEvent?.(event, parsed);

        // ── Outer envelope events ──────────────────────────────
        if (event === 'phase') {
          // Server may send {phase:'claude', model, fastMode} etc.
          if (parsed?.phase) cb.onPhase?.(parsed.phase);
          continue;
        }
        if (
          event === 'restore' || event === 'setup' || event === 'snapshot' ||
          event === 'diff' || event === 'claude_ms' || event === 'done'
        ) {
          cb.onSandboxEvent?.(event, parsed);
          continue;
        }
        if (event === 'claude_ttfo') {
          // Backend's own time-to-first-output marker. Honour it (and mark
          // firstOutput so we don't double-fire from the first stdout token).
          firstOutput = true;
          cb.onSandboxEvent?.('claude_ttfo', parsed);
          continue;
        }
        if (event === 'stall-warning') {
          cb.onSandboxEvent?.('stall-warning', parsed);
          continue;
        }
        if (event !== 'stdout') continue;

        // ── stdout payloads: Claude Code stream-json ───────────
        const t = parsed?.type;
        const sub = parsed?.subtype;

        if (t === 'system' && sub === 'init') {
          cb.onSystemInit?.({
            model: parsed.model,
            tools: parsed.tools,
            cwd: parsed.cwd,
          });
          continue;
        }

        if (t === 'stream_event') {
          const ev = parsed.event;
          if (!ev) continue;

          if (ev.type === 'content_block_start') {
            markFirstOutput();
            const b = ev.content_block;
            if (b?.type === 'text') {
              cb.onBlockStart?.({ type: 'text', index: ev.index });
            } else if (b?.type === 'thinking') {
              cb.onBlockStart?.({ type: 'thinking', index: ev.index });
            } else if (b?.type === 'tool_use') {
              cb.onBlockStart?.({
                type: 'tool_use',
                index: ev.index,
                tool: { name: b.name, id: b.id },
              });
            }
          } else if (ev.type === 'content_block_delta') {
            markFirstOutput();
            const d = ev.delta;
            if (d?.type === 'text_delta' && d.text) {
              cb.onTextDelta?.(d.text, ev.index);
            } else if (d?.type === 'thinking_delta' && d.thinking) {
              cb.onThinkingDelta?.(d.thinking, ev.index);
            } else if (d?.type === 'input_json_delta' && d.partial_json) {
              cb.onToolInputDelta?.(d.partial_json, ev.index);
            }
          } else if (ev.type === 'content_block_stop') {
            cb.onBlockStop?.(ev.index);
          }
          continue;
        }

        if (t === 'user' && Array.isArray(parsed.message?.content)) {
          // tool_result blocks come back via a user message
          for (const blk of parsed.message.content) {
            if (blk?.type === 'tool_result') {
              const content = Array.isArray(blk.content)
                ? blk.content
                    .map((c: any) => (typeof c === 'string' ? c : c.text || JSON.stringify(c)))
                    .join('\n')
                : String(blk.content ?? '');
              cb.onToolResult?.({
                toolUseId: blk.tool_use_id,
                content,
                isError: blk.is_error,
              });
            }
          }
          continue;
        }

        if (t === 'assistant' && Array.isArray(parsed.message?.content)) {
          const text = parsed.message.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('');
          if (text) cb.onAssistantFinal?.(text);
          continue;
        }

        if (t === 'result') {
          if (sub && sub !== 'success') {
            const err = new Error(parsed.error || `Claude Code run ${sub}`);
            cb.onError?.(err);
            throw err;
          }
          cb.onResult?.({
            success: true,
            durationMs: parsed.duration_ms,
            usage: parsed.usage,
          });
          continue;
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* noop */ }
  }
}

export function deriveRepoUrlFromSkillMd(skillMdUrl: string | undefined): string | null {
  if (!skillMdUrl) return null;
  const m = skillMdUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\//);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}
