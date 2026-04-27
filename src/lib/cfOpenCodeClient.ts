// ============================================================
// Cloudflare Sandbox-hosted OpenCode client.
// ============================================================
// Mirrors cfClaudeCodeClient.ts but for the OpenCode CLI sandbox
// (oc-sandbox), proxied through our Worker at /api/oc/run.
//
// The outer SSE envelope is the same as cc-sandbox:
//   event: phase     {phase: "restore" | "setup" | "opencode"}
//   event: restore   {ok, ms, id}
//   event: setup     {ok, ms, exitCode, tail}
//   event: stderr    "<line>"
//   event: stdout    {type, ...}   ← OpenCode parts
//
// The "stdout" payload differs from Claude Code's stream-events:
//   {type: "step_start"}
//   {type: "text",     part: {type: "text", text: "...the response..."}}
//   {type: "tool_use", part: {type: "tool", tool: "read", state: {...}}}
//   {type: "step_finish", part: {tokens, snapshot, ...}}
// OpenCode emits FULL text per part (not deltas) — multiple text parts
// per session represent successive assistant turns.
// ============================================================

const API_BASE =
  (import.meta.env.VITE_PAYMENT_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  '/api';

export interface OCBudget {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  upstream: string;
  resets_in_seconds: number;
}

export interface OCStreamCallbacks {
  /** "restore" | "setup" | "opencode" — coarse-grained sandbox progress. */
  onPhase?: (phase: string) => void;
  /** Called once per text part with full text — append to running output. */
  onText?: (text: string) => void;
  /** Called when a tool_use part appears (tool name, brief description). */
  onToolUse?: (tool: string, summary: string) => void;
  /** Raw event passthrough for debug / advanced UI. */
  onEvent?: (event: string, data: unknown) => void;
  /** Called when the upstream sends a final completion signal. */
  onDone?: (result: { success: boolean; durationMs?: number }) => void;
  /** Called on any I/O failure. */
  onError?: (err: Error) => void;
}

export async function getOCBudget(): Promise<OCBudget | null> {
  try {
    const r = await fetch(`${API_BASE}/oc/budget`, { credentials: 'include' });
    if (!r.ok) return null;
    return await r.json() as OCBudget;
  } catch {
    return null;
  }
}

/** Streams an OpenCode Sandbox run; returns the assembled assistant text. */
export async function streamOpenCodeRun(
  params: { repo: string; task: string },
  cb: OCStreamCallbacks = {},
): Promise<string> {
  const r = await fetch(`${API_BASE}/oc/run`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (r.status === 429) {
    const j = await r.json().catch(() => ({})) as { message?: string };
    const e = new Error(j.message || 'Daily OpenCode Sandbox limit reached.');
    cb.onError?.(e);
    throw e;
  }
  if (!r.ok || !r.body) {
    const body = await r.text().catch(() => '');
    const e = new Error(`OpenCode Sandbox failed (${r.status}): ${body.slice(0, 200)}`);
    cb.onError?.(e);
    throw e;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let collected = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

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
        continue;
      }

      if (event !== 'stdout' || !parsed) continue;

      const t = parsed.type;
      if (t === 'text' && parsed.part?.text) {
        collected += parsed.part.text;
        cb.onText?.(parsed.part.text);
      } else if (t === 'tool_use' && parsed.part?.tool) {
        const tool = parsed.part.tool;
        const input = parsed.part.state?.input;
        const summary = input
          ? Object.entries(input).slice(0, 1).map(([k, v]) =>
              `${k}=${typeof v === 'string' ? v.slice(0, 80) : JSON.stringify(v).slice(0, 80)}`).join(', ')
          : '';
        cb.onToolUse?.(tool, summary);
      } else if (t === 'step_finish' && parsed.part?.reason === 'end_turn') {
        // OpenCode signals end of assistant turn here; treat as done.
        cb.onDone?.({ success: true });
      }
    }
  }

  cb.onDone?.({ success: true });
  return collected;
}

/** Same heuristic as the CC client: derive a github clone URL from a skill md URL. */
export function deriveRepoUrlFromSkillMd(skillMdUrl: string | undefined): string | null {
  if (!skillMdUrl) return null;
  const m = skillMdUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\//);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}
