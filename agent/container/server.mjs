// ============================================================
// Persistent Claude Agent server — runs INSIDE the Cloudflare
// Sandbox container, one long-lived process for the whole
// container lifetime. Each WebSocket connection gets ONE
// persistent `query()` session: turn 2..N reuse the warm
// session with zero re-init. This is what makes the web UX
// feel exactly like using Claude Code directly.
// ============================================================
//
// Transport: ws://0.0.0.0:4500  (the Cloudflare worker bridges
// the browser WebSocket straight here via the Sandbox port proxy)
//
// Client → server JSON frames:
//   { "type":"init", "skillMd"?, "skillName"?, "model"? }   (optional, once)
//   { "type":"user", "text": "..." }                        (a turn)
//   { "type":"interrupt" }                                   (cancel turn)
//
// Server → client JSON frames:
//   { "type":"ready" }                       socket warm, send a turn
//   { "type":"session", "id": "..." }        agent session id (resumable)
//   <raw Claude Agent SDK message>           system/init, stream_event,
//                                            assistant, user(tool_result),
//                                            result/success — forwarded
//                                            verbatim so the existing
//                                            frontend parser just works
//   { "type":"turn_done" }                   ready for the next turn
//   { "type":"error", "message": "..." }
// ============================================================

import { WebSocketServer } from 'ws';
import { mkdir, writeFile } from 'node:fs/promises';
import { query } from '@anthropic-ai/claude-agent-sdk';

const PORT = Number(process.env.AGENT_PORT || 4500);
const WORKSPACE = '/workspace';

const SKILL_SYSTEM =
  'You are a Candy Shop skill agent operating an interactive session. ' +
  'Follow the skill definition in ./SKILL.md (also loaded as project ' +
  'memory). Be decisive — produce the concrete deliverable the skill ' +
  'describes without asking clarifying questions unless the request is ' +
  'truly impossible without them. Keep responses tight and act fast; ' +
  'this is a live, latency-sensitive session.';

/** Promise-based async queue (no polling) feeding the SDK streaming input. */
class MessageQueue {
  constructor() {
    this.items = [];
    this.waiters = [];
    this.closed = false;
  }
  push(item) {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) w({ value: item, done: false });
    else this.items.push(item);
  }
  close() {
    this.closed = true;
    while (this.waiters.length) this.waiters.shift()({ value: undefined, done: true });
  }
  [Symbol.asyncIterator]() {
    return {
      next: () => {
        if (this.items.length) return Promise.resolve({ value: this.items.shift(), done: false });
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => this.waiters.push(resolve));
      },
    };
  }
}

const wss = new WebSocketServer({ host: '0.0.0.0', port: PORT });

wss.on('connection', (ws) => {
  /** @type {MessageQueue|null} */
  let queue = null;
  /** @type {ReturnType<typeof query>|null} */
  let q = null;
  let started = false;
  let skillMd = '';
  let model;
  let cwd = WORKSPACE;
  let pumpRunning = false;

  const send = (obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };

  // Drain SDK messages → client. Runs for the whole session lifetime.
  async function pumpOutput() {
    pumpRunning = true;
    try {
      for await (const msg of q) {
        // Forward raw SDK message; frontend already understands the
        // Claude stream-json shapes (system/init, stream_event,
        // assistant, user tool_result, result).
        send(msg);
        if (msg.type === 'result') send({ type: 'turn_done' });
      }
    } catch (err) {
      send({ type: 'error', message: err?.message || String(err) });
    } finally {
      pumpRunning = false;
    }
  }

  async function ensureSession() {
    if (started) return;
    started = true;

    await mkdir(cwd, { recursive: true }).catch(() => {});
    const skillDoc =
      skillMd?.trim() ||
      '# Skill\n\nNo skill definition supplied. Treat each user message ' +
        'as a direct task and complete it.';
    await Promise.all([
      writeFile(`${cwd}/SKILL.md`, skillDoc).catch(() => {}),
      writeFile(`${cwd}/CLAUDE.md`, skillDoc).catch(() => {}),
    ]);

    queue = new MessageQueue();
    q = query({
      prompt: queue,
      options: {
        cwd,
        model: model || undefined,
        permissionMode: 'bypassPermissions',
        includePartialMessages: true,
        maxTurns: 1000,
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append: `${SKILL_SYSTEM}\n\n--- SKILL DEFINITION ---\n${skillDoc}`,
        },
      },
    });
    pumpOutput();
  }

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send({ type: 'error', message: 'invalid JSON frame' });
    }

    try {
      if (msg.type === 'init') {
        if (started) return; // session already running; ignore late init
        if (typeof msg.skillMd === 'string') skillMd = msg.skillMd;
        if (typeof msg.model === 'string') model = msg.model;
        return; // lazy: real session starts on first user turn
      }

      if (msg.type === 'user') {
        const text = typeof msg.text === 'string' ? msg.text.trim() : '';
        if (!text) return send({ type: 'error', message: 'empty user text' });
        if (typeof msg.skillMd === 'string' && !started) skillMd = msg.skillMd;
        if (typeof msg.model === 'string' && !started) model = msg.model;
        await ensureSession();
        queue.push({
          type: 'user',
          message: { role: 'user', content: text },
          parent_tool_use_id: null,
        });
        return;
      }

      if (msg.type === 'interrupt') {
        if (q && pumpRunning) await q.interrupt().catch(() => {});
        return send({ type: 'interrupted' });
      }

      send({ type: 'error', message: `unknown frame type: ${msg.type}` });
    } catch (err) {
      send({ type: 'error', message: err?.message || String(err) });
    }
  });

  const cleanup = () => {
    try { queue?.close(); } catch {}
    try { q?.close?.(); } catch {}
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);

  send({ type: 'ready' });
});

wss.on('listening', () => {
  console.log(`[candy-agent] persistent Claude Agent server on ws://0.0.0.0:${PORT}`);
});
