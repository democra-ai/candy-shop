// ============================================================
// Claude Code agent client — PERSISTENT WARM WEBSOCKET SESSION.
// ============================================================
// Old model (high latency): every turn POSTed /api/cc/run, which
// cold-started a sandbox and ran `claude --print` from scratch.
//
// New model (this file): the browser holds ONE WebSocket to the
// agent worker (`cc-sandbox`), which bridges to a persistent
// Claude Agent SDK session inside a kept-warm container. The
// session is created once and reused for every turn — turn 2..N
// have no cold start and no re-init, so it feels exactly like
// using Claude Code directly.
//
// Anti-abuse: the socket can only be opened with a short-lived
// HMAC ticket minted by /api/cc/ticket *after* the user's session
// is validated. The agent worker rejects anything else, so the
// endpoint can't be scanned/freeloaded.
//
// The public API (streamClaudeCodeRun / CCStreamCallbacks /
// getCCBudget / deriveRepoUrlFromSkillMd) is unchanged, so the
// SkillExecutor UI keeps working — only the transport changed.
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

// ── ticket + url helpers ───────────────────────────────────

interface Ticket { ticket: string; exp: number; agentUrl: string }

async function mintTicket(skill?: string): Promise<Ticket> {
  const r = await fetch(`${API_BASE}/cc/ticket`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skill }),
  });
  if (!r.ok) {
    const e = await r.text().catch(() => '');
    throw new Error(`agent ticket denied (${r.status}): ${e.slice(0, 160)}`);
  }
  return (await r.json()) as Ticket;
}

function wsUrl(agentUrl: string, ticket: string): string {
  const u = new URL(agentUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = u.pathname.replace(/\/+$/, '') + '/ws';
  u.search = `?ticket=${encodeURIComponent(ticket)}`;
  return u.toString();
}

/** Fire-and-forget pre-boot: mint a ticket and ask the agent to warm the
 *  container before the user's first turn, so cold start is invisible. */
export async function warmClaudeAgent(skill?: string): Promise<void> {
  try {
    const t = await mintTicket(skill);
    const base = t.agentUrl.replace(/\/+$/, '');
    await fetch(`${base}/warm?ticket=${encodeURIComponent(t.ticket)}`, {
      method: 'POST',
    }).catch(() => {});
  } catch {
    /* best-effort */
  }
}

// ── persistent session singleton ───────────────────────────

type Pending = {
  cb: CCStreamCallbacks;
  resolve: () => void;
  reject: (e: Error) => void;
  startedAt: number;
  firstOutput: boolean;
  settled: boolean;
};

class AgentSession {
  private ws: WebSocket | null = null;
  private connecting: Promise<void> | null = null;
  private skillKey = '';
  private initialised = false;
  private pending: Pending | null = null;
  private model?: string;

  private fail(e: Error) {
    if (this.pending && !this.pending.settled) {
      this.pending.settled = true;
      this.pending.cb.onError?.(e);
      this.pending.reject(e);
      this.pending = null;
    }
  }

  private async open(skillMd: string | undefined, model: string | undefined) {
    const skillKey = skillMd ?? '';
    // Reuse the warm socket unless the skill identity changed.
    if (
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      this.skillKey === skillKey
    ) {
      return;
    }
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      this.close();
      this.skillKey = skillKey;
      this.initialised = false;
      this.model = model;

      const t = await mintTicket();
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const ws = new WebSocket(wsUrl(t.agentUrl, t.ticket));
        this.ws = ws;
        const to = setTimeout(() => {
          if (!settled) {
            settled = true;
            try { ws.close(); } catch { /* noop */ }
            reject(new Error('agent connection timed out'));
          }
        }, 30_000);

        ws.onmessage = (ev) => {
          let msg: any;
          try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); }
          catch { return; }
          if (msg?.type === 'ready' && !settled) {
            settled = true;
            clearTimeout(to);
            // Send the skill definition once for this connection.
            ws.send(JSON.stringify({
              type: 'init', skillMd: skillMd || undefined, model: this.model,
            }));
            this.initialised = true;
            resolve();
            return;
          }
          this.dispatch(msg);
        };
        ws.onerror = () => {
          if (!settled) { settled = true; clearTimeout(to); reject(new Error('agent socket error')); }
          else this.fail(new Error('agent socket error'));
        };
        ws.onclose = () => {
          this.ws = null;
          if (!settled) { settled = true; clearTimeout(to); reject(new Error('agent socket closed')); }
          else this.fail(new Error('agent session closed'));
        };
      });
    })().finally(() => { this.connecting = null; });

    return this.connecting;
  }

  /** Translate raw Claude Agent SDK / envelope frames into the existing
   *  CCStreamCallbacks the SkillExecutor UI already renders. */
  private dispatch(msg: any) {
    const p = this.pending;
    if (!p) {
      // Out-of-turn frames (e.g. late tool noise) — ignore safely.
      return;
    }
    p.cb.onEvent?.(msg?.type ?? 'message', msg);

    const markFirstOutput = () => {
      if (!p.firstOutput) {
        p.firstOutput = true;
        p.cb.onSandboxEvent?.('claude_ttfo', { ms: Date.now() - p.startedAt });
      }
    };

    switch (msg?.type) {
      case 'system':
        if (msg.subtype === 'init') {
          p.cb.onSystemInit?.({ model: msg.model, tools: msg.tools, cwd: msg.cwd });
        }
        return;

      case 'stream_event': {
        const e = msg.event;
        if (!e) return;
        if (e.type === 'content_block_start') {
          markFirstOutput();
          const b = e.content_block;
          if (b?.type === 'text') p.cb.onBlockStart?.({ type: 'text', index: e.index });
          else if (b?.type === 'thinking') p.cb.onBlockStart?.({ type: 'thinking', index: e.index });
          else if (b?.type === 'tool_use')
            p.cb.onBlockStart?.({ type: 'tool_use', index: e.index, tool: { name: b.name, id: b.id } });
        } else if (e.type === 'content_block_delta') {
          markFirstOutput();
          const d = e.delta;
          if (d?.type === 'text_delta' && d.text) p.cb.onTextDelta?.(d.text, e.index);
          else if (d?.type === 'thinking_delta' && d.thinking) p.cb.onThinkingDelta?.(d.thinking, e.index);
          else if (d?.type === 'input_json_delta' && d.partial_json) p.cb.onToolInputDelta?.(d.partial_json, e.index);
        } else if (e.type === 'content_block_stop') {
          p.cb.onBlockStop?.(e.index);
        }
        return;
      }

      case 'user':
        if (Array.isArray(msg.message?.content)) {
          for (const blk of msg.message.content) {
            if (blk?.type === 'tool_result') {
              const content = Array.isArray(blk.content)
                ? blk.content.map((x: any) => (typeof x === 'string' ? x : x.text || JSON.stringify(x))).join('\n')
                : String(blk.content ?? '');
              p.cb.onToolResult?.({ toolUseId: blk.tool_use_id, content, isError: blk.is_error });
            }
          }
        }
        return;

      case 'assistant':
        if (Array.isArray(msg.message?.content)) {
          const text = msg.message.content
            .filter((x: any) => x.type === 'text')
            .map((x: any) => x.text)
            .join('');
          if (text) p.cb.onAssistantFinal?.(text);
        }
        return;

      case 'result':
        p.cb.onSandboxEvent?.('claude_ms', { ms: Date.now() - p.startedAt });
        p.cb.onSandboxEvent?.('done', {});
        if (msg.subtype && msg.subtype !== 'success') {
          this.fail(new Error(msg.error || `agent ${msg.subtype}`));
        } else {
          p.cb.onResult?.({ success: true, durationMs: msg.duration_ms, usage: msg.usage });
          if (!p.settled) { p.settled = true; p.resolve(); this.pending = null; }
        }
        return;

      case 'turn_done':
        if (p && !p.settled) { p.settled = true; p.resolve(); this.pending = null; }
        return;

      case 'error':
        this.fail(new Error(msg.message || 'agent error'));
        return;
    }
  }

  async runTurn(
    params: { task: string; skillMd?: string; model?: string },
    cb: CCStreamCallbacks,
  ): Promise<void> {
    cb.onPhase?.('setup');
    const wasWarm =
      !!this.ws && this.ws.readyState === WebSocket.OPEN &&
      this.skillKey === (params.skillMd ?? '');

    await this.open(params.skillMd, params.model);
    cb.onSandboxEvent?.('restore', { skipped: wasWarm, ms: 0 });
    cb.onSandboxEvent?.('setup', { skipped: wasWarm, tail: wasWarm ? 'warm session' : 'session ready' });

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('agent session unavailable');
    }

    cb.onPhase?.('claude');
    await new Promise<void>((resolve, reject) => {
      this.pending = {
        cb, resolve, reject,
        startedAt: Date.now(),
        firstOutput: false,
        settled: false,
      };
      this.ws!.send(JSON.stringify({
        type: 'user',
        text: params.task,
        skillMd: this.initialised ? undefined : params.skillMd,
        model: params.model,
      }));
    });
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }
    this.initialised = false;
  }
}

let session: AgentSession | null = null;

/** Reset the persistent session (e.g. when switching skills or on logout). */
export function resetClaudeSession(): void {
  session?.close();
  session = null;
}

/**
 * Run one turn against the persistent warm Claude Code session.
 * Signature/behaviour is API-compatible with the old SSE function, so
 * SkillExecutor needs no change — but turns after the first are instant.
 * `repo` is accepted for compatibility and currently ignored (the agent
 * runs in a per-user persistent workspace).
 */
export async function streamClaudeCodeRun(
  params: { task: string; repo?: string; skillMd?: string; model?: string; fresh?: boolean },
  cb: CCStreamCallbacks = {},
): Promise<void> {
  if (params.fresh) resetClaudeSession();
  if (!session) session = new AgentSession();
  try {
    await session.runTurn(
      { task: params.task, skillMd: params.skillMd, model: params.model },
      cb,
    );
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    cb.onError?.(err);
    // A dead socket shouldn't poison the next turn.
    resetClaudeSession();
    throw err;
  }
}

export function deriveRepoUrlFromSkillMd(skillMdUrl: string | undefined): string | null {
  if (!skillMdUrl) return null;
  const m = skillMdUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\//);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}
