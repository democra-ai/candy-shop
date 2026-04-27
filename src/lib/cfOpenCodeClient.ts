// ============================================================
// Cloudflare Sandbox-hosted OpenCode client (verbose terminal mode).
// ============================================================
// POSTs {repo, task} to /api/oc/run, which proxies oc-sandbox.
//
// Outer envelope:    phase / restore / setup / stdout
// stdout payloads (OpenCode part format — full text per part, no token deltas):
//   step_start                 — assistant turn begins (new step)
//   text       part:{type:text, text:"..."}    — full text of this turn
//   tool_use   part:{type:tool, tool:"read"|"bash"|..., state:{input,output,...}}
//   step_finish part:{reason:"tool-calls"|"stop"|"end_turn", tokens:{...}, cost}
//
// OpenCode does NOT stream tokens — it emits full segments per part. So
// "live" UX comes from showing each part as it arrives (read this file,
// then read that file, then a paragraph of text, then end).
// ============================================================

const API_BASE =
  (import.meta.env.VITE_PAYMENT_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  '/api';

export interface OCBudget {
  date: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  upstream: string;
  resets_in_seconds: number;
}

export interface OCStreamCallbacks {
  onPhase?: (phase: string) => void;
  onSandboxEvent?: (event: 'restore' | 'setup', data: Record<string, unknown>) => void;
  /** Stderr line from the sandbox (e.g. db migration messages). */
  onStderr?: (line: string) => void;
  /** A new agent step begins. */
  onStepStart?: (info: { sessionID: string; messageID: string }) => void;
  /** A whole text segment (full content of one assistant turn). */
  onText?: (text: string) => void;
  /** A tool call with full state (input + output, both already known). */
  onToolUse?: (info: {
    tool: string;
    callId: string;
    input?: Record<string, unknown>;
    output?: string;
    title?: string;
    status?: string;
    isError?: boolean;
  }) => void;
  /** Step ended (with token usage + reason). */
  onStepFinish?: (info: {
    reason: string;
    tokens?: { input?: number; output?: number; total?: number };
    cost?: number;
  }) => void;
  /** Generic raw event (debug). */
  onEvent?: (event: string, data: unknown) => void;
  onError?: (err: Error) => void;
}

export async function getOCBudget(): Promise<OCBudget | null> {
  try {
    const r = await fetch(`${API_BASE}/oc/budget`, { credentials: 'include' });
    if (!r.ok) return null;
    return await r.json() as OCBudget;
  } catch { return null; }
}

export async function streamOpenCodeRun(
  params: { repo: string; task: string },
  cb: OCStreamCallbacks = {},
): Promise<void> {
  const r = await fetch(`${API_BASE}/oc/run`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!r.ok || !r.body) {
    const body = await r.text().catch(() => '');
    const e = new Error(`OpenCode Sandbox failed (${r.status}): ${body.slice(0, 200)}`);
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
      try { parsed = JSON.parse(dataStr); } catch { /* raw */ }
      cb.onEvent?.(event, parsed);

      if (event === 'phase' && parsed?.phase) {
        cb.onPhase?.(parsed.phase);
        continue;
      }
      if (event === 'restore' || event === 'setup') {
        cb.onSandboxEvent?.(event as 'restore' | 'setup', parsed ?? {});
        continue;
      }
      if (event === 'stderr') {
        // stderr arrives as raw string in `dataStr`, parsed as same string
        const line = typeof parsed === 'string' ? parsed : dataStr;
        if (line.trim()) cb.onStderr?.(line);
        continue;
      }
      if (event !== 'stdout') continue;

      const t = parsed?.type;
      const part = parsed?.part;

      if (t === 'step_start') {
        cb.onStepStart?.({
          sessionID: parsed.sessionID ?? '',
          messageID: parsed.part?.messageID ?? '',
        });
        continue;
      }

      if (t === 'text' && part?.text != null) {
        cb.onText?.(part.text);
        continue;
      }

      if (t === 'tool_use' && part) {
        const state = part.state || {};
        cb.onToolUse?.({
          tool: part.tool ?? 'unknown',
          callId: part.callID ?? '',
          input: state.input,
          output: state.output,
          title: part.title,
          status: state.status,
          isError: state.status === 'error' || state.error != null,
        });
        continue;
      }

      if (t === 'step_finish' && part) {
        cb.onStepFinish?.({
          reason: part.reason ?? '',
          tokens: part.tokens,
          cost: part.cost,
        });
        continue;
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
