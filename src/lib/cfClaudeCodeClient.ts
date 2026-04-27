// ============================================================
// Cloudflare Sandbox-hosted Claude Code client (verbose terminal mode).
// ============================================================
// POSTs {repo, task} to our Worker's /api/cc/run, which proxies to
// cc-sandbox.candy-shop.workers.dev. Two layers of SSE:
//
//   Outer envelope:   phase / restore / setup / stdout / snapshot /
//                     diff / claude_ms / done
//
//   stdout payloads (Claude Code stream-event format):
//     system/init                     — env, available tools, model
//     system/status                   — "requesting"
//     stream_event/message_start      — assistant message starts
//     stream_event/content_block_start
//                                     - type:text                 ← assistant text begins
//                                     - type:thinking             ← reasoning begins
//                                     - type:tool_use {name,id}   ← tool call begins
//     stream_event/content_block_delta
//                                     - text_delta                ← TOKEN-BY-TOKEN text
//                                     - thinking_delta            ← TOKEN-BY-TOKEN thinking
//                                     - input_json_delta          ← tool args streamed
//     stream_event/content_block_stop
//     stream_event/message_delta      — usage stats
//     stream_event/message_stop
//     user                            — tool_result blocks
//     assistant                       — completed assistant message
//     result/success                  — final summary
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

/** Each callback fires the instant the event lands — render side appends to log. */
export interface CCStreamCallbacks {
  /** Sandbox phase change: restore | setup | claude */
  onPhase?: (phase: string) => void;
  /** Sandbox lifecycle event with timing/details. */
  onSandboxEvent?: (event: 'restore' | 'setup' | 'snapshot' | 'diff' | 'claude_ms' | 'done',
                    data: Record<string, unknown>) => void;
  /** Claude Code system init — model, tools available. */
  onSystemInit?: (info: { model?: string; tools?: string[]; cwd?: string }) => void;
  /** A new content block begins. type can be 'text', 'thinking', 'tool_use'. */
  onBlockStart?: (block: { type: 'text' | 'thinking' | 'tool_use';
                            index: number;
                            tool?: { name: string; id: string } }) => void;
  /** Token-by-token text in the assistant's reply. */
  onTextDelta?: (delta: string, blockIndex: number) => void;
  /** Token-by-token reasoning. */
  onThinkingDelta?: (delta: string, blockIndex: number) => void;
  /** Streaming bytes of a tool's JSON input args (e.g. {"file_path":"…). */
  onToolInputDelta?: (partialJson: string, blockIndex: number) => void;
  /** A content block ended. */
  onBlockStop?: (blockIndex: number) => void;
  /** A tool_result message arrived (returned by the sandbox after a tool ran). */
  onToolResult?: (result: { toolUseId: string; content: string; isError?: boolean }) => void;
  /** Full final answer (assistant message echoed after streaming). */
  onAssistantFinal?: (text: string) => void;
  /** Run finished. */
  onResult?: (result: { success: boolean; durationMs?: number; usage?: unknown }) => void;
  /** Generic raw event (debug). */
  onEvent?: (event: string, data: unknown) => void;
  /** Network/SSE-level errors. */
  onError?: (err: Error) => void;
}

export async function getCCBudget(): Promise<CCBudget | null> {
  try {
    const r = await fetch(`${API_BASE}/cc/budget`, { credentials: 'include' });
    if (!r.ok) return null;
    return await r.json() as CCBudget;
  } catch { return null; }
}

export async function streamClaudeCodeRun(
  params: { task: string; repo?: string; skillMd?: string; model?: string; fresh?: boolean },
  cb: CCStreamCallbacks = {},
): Promise<void> {
  const r = await fetch(`${API_BASE}/cc/run`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!r.ok || !r.body) {
    const body = await r.text().catch(() => '');
    const e = new Error(`Claude Code Sandbox failed (${r.status}): ${body.slice(0, 200)}`);
    cb.onError?.(e);
    throw e;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
        else if (line.startsWith('data: ')) dataStr = dataStr ? dataStr + '\n' + line.slice(6) : line.slice(6);
      }
      if (!dataStr) continue;

      let parsed: any = dataStr;
      try { parsed = JSON.parse(dataStr); } catch { /* keep raw */ }
      cb.onEvent?.(event, parsed);

      // Outer envelope events
      if (event === 'phase' && parsed?.phase) {
        cb.onPhase?.(parsed.phase);
        continue;
      }
      if (event === 'restore' || event === 'setup' || event === 'snapshot' ||
          event === 'diff' || event === 'claude_ms' || event === 'done') {
        cb.onSandboxEvent?.(event, parsed);
        continue;
      }
      if (event !== 'stdout') continue;

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
              ? blk.content.map((c: any) => typeof c === 'string' ? c : c.text || JSON.stringify(c)).join('\n')
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

      if (t === 'result' && sub === 'success') {
        cb.onResult?.({
          success: true,
          durationMs: parsed.duration_ms,
          usage: parsed.usage,
        });
      }
    }
  }
}

export function deriveRepoUrlFromSkillMd(skillMdUrl: string | undefined): string | null {
  if (!skillMdUrl) return null;
  const m = skillMdUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\//);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}
