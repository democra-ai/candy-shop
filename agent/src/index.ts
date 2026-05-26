// ============================================================
// Candy Shop agent worker (deploys as `cc-sandbox`).
//
// Bridges the browser WebSocket straight to a PERSISTENT Claude
// Agent server running inside a kept-warm Cloudflare Sandbox
// container. One container per authenticated user, reused across
// turns and reconnects → no per-turn cold start, instant
// subsequent turns. Pattern follows Cloudflare's official
// codex-app-server example.
//
// Anti-abuse: every WS/warm request MUST carry a short-lived
// HMAC ticket minted by the main API worker (which holds the
// user's authenticated session). Without a valid, unexpired,
// signature-checked ticket the request is rejected before any
// container or LLM work happens — so the endpoint cannot be
// scanned/freeloaded.
// ============================================================

import { switchPort } from '@cloudflare/containers';
import {
  Sandbox as BaseSandbox,
  getSandbox,
  proxyToSandbox,
} from '@cloudflare/sandbox';

export { ContainerProxy } from '@cloudflare/sandbox';

interface Env {
  Sandbox: DurableObjectNamespace<Sandbox>;
  // Real Anthropic credential — injected on the way out, never enters the
  // container.
  ANTHROPIC_API_KEY?: string;
  CLAUDE_CODE_OAUTH_TOKEN?: string;
  // Shared HMAC secret with the main API worker, used to verify access
  // tickets. Set via: wrangler secret put CC_AGENT_TICKET_SECRET
  CC_AGENT_TICKET_SECRET?: string;
  // How long an idle container stays warm (default 20m — long enough that
  // a user reading/thinking between turns never pays cold start again).
  SANDBOX_SLEEP_AFTER?: string;
}

const AGENT_PORT = 4500;
const AGENT_PROCESS_ID = 'candy-agent';

// ── Egress: inject the real Anthropic key, keep it out of the container ──

export class Sandbox extends BaseSandbox<Env> {
  interceptHttps = true;
}

Sandbox.outboundByHost = {
  'api.anthropic.com': async (request: Request, env: Env) => {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    if (env.ANTHROPIC_API_KEY) {
      headers.set('x-api-key', env.ANTHROPIC_API_KEY);
      headers.delete('authorization');
    } else if (env.CLAUDE_CODE_OAUTH_TOKEN) {
      headers.set('authorization', `Bearer ${env.CLAUDE_CODE_OAUTH_TOKEN}`);
      headers.delete('x-api-key');
    }
    return fetch(`https://api.anthropic.com${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: request.body,
    });
  },
};

// ── Ticket auth ─────────────────────────────────────────────
// Ticket = base64url(payloadJSON) + "." + base64url(HMAC-SHA256(payload)).
// payload = { sub, exp, skill? }. Minted by the main worker after it has
// validated the user's session; verified here. Short TTL so a leaked URL
// is useless within ~2 minutes.

const b64urlToBytes = (s: string): Uint8Array => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

interface Ticket { sub: string; exp: number; skill?: string }

async function verifyTicket(
  token: string | null,
  secret: string | undefined,
): Promise<Ticket | null> {
  if (!token || !secret) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  let payload: Ticket;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch {
    return null;
  }
  if (!payload?.sub || typeof payload.exp !== 'number') return null;
  if (Date.now() > payload.exp) return null;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlToBytes(sigB64),
    new TextEncoder().encode(payloadB64),
  );
  return ok ? payload : null;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// ── Container lifecycle ─────────────────────────────────────

function sandboxFor(env: Env, sub: string) {
  const sleepAfter = env.SANDBOX_SLEEP_AFTER || '20m';
  // One warm container per authenticated user. Reused across turns and
  // reconnects — the persistent agent session lives inside it.
  return getSandbox(env.Sandbox, `agent-${sub}`, { sleepAfter });
}

async function ensureAgentRunning(
  sandbox: ReturnType<typeof getSandbox>,
  env: Env,
): Promise<void> {
  const procs = await sandbox.listProcesses().catch(() => []);
  const existing = procs.find((p: { id: string }) => p.id === AGENT_PROCESS_ID);
  if (
    existing &&
    ((existing as { status?: string }).status === 'running' ||
      (existing as { status?: string }).status === 'starting')
  ) {
    return;
  }

  // The container only ever sees a placeholder; the real key is injected
  // by the outbound handler above.
  const placeholder = env.ANTHROPIC_API_KEY
    ? { ANTHROPIC_API_KEY: 'proxy-injected' }
    : { CLAUDE_CODE_OAUTH_TOKEN: 'proxy-injected' };
  await sandbox.setEnvVars({ ...placeholder, AGENT_PORT: String(AGENT_PORT) });

  const proc = await sandbox.startProcess('node /agent-server/server.mjs', {
    processId: AGENT_PROCESS_ID,
  });
  await proc.waitForPort(AGENT_PORT, { mode: 'tcp' });
}

async function connectToContainer(
  sandbox: ReturnType<typeof getSandbox>,
): Promise<WebSocket> {
  const wsReq = switchPort(
    new Request('http://container/', {
      headers: { Upgrade: 'websocket', Connection: 'Upgrade' },
    }),
    AGENT_PORT,
  );
  const res = await sandbox.fetch(wsReq);
  const ws = (res as unknown as { webSocket: WebSocket | null }).webSocket;
  if (!ws) throw new Error('failed to open container WebSocket');
  return ws;
}

// ── WebSocket bridge ────────────────────────────────────────

async function handleWs(
  request: Request,
  ticket: Ticket,
  env: Env,
): Promise<Response> {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('expected websocket upgrade', { status: 426 });
  }

  const sandbox = sandboxFor(env, ticket.sub);
  await ensureAgentRunning(sandbox, env);
  const containerWs = await connectToContainer(sandbox);

  const [clientWs, serverWs] = Object.values(new WebSocketPair());
  serverWs.accept();
  containerWs.accept();

  const relay = (from: WebSocket, to: WebSocket) => {
    from.addEventListener('message', (e: MessageEvent) => {
      if (to.readyState === WebSocket.OPEN) to.send(e.data as string);
    });
  };
  relay(serverWs, containerWs);
  relay(containerWs, serverWs);

  const closeBoth = (a: WebSocket, code?: number, reason?: string) => {
    try { a.close(code, reason); } catch { /* already closed */ }
  };
  serverWs.addEventListener('close', (e: CloseEvent) =>
    closeBoth(containerWs, e.code, e.reason));
  containerWs.addEventListener('close', (e: CloseEvent) =>
    closeBoth(serverWs, e.code, e.reason));
  serverWs.addEventListener('error', () => closeBoth(containerWs, 1011, 'client error'));
  containerWs.addEventListener('error', () => closeBoth(serverWs, 1011, 'container error'));

  return new Response(null, { status: 101, webSocket: clientWs });
}

// ── Entrypoint ──────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Sandbox preview/port proxy passthrough (kept for completeness).
    const proxied = await proxyToSandbox(request, env);
    if (proxied) return proxied;

    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({
        service: 'candy-shop-agent (cc-sandbox)',
        ok: !!(env.ANTHROPIC_API_KEY || env.CLAUDE_CODE_OAUTH_TOKEN),
        authConfigured: !!env.CC_AGENT_TICKET_SECRET,
        transport: 'websocket',
        endpoints: { warm: 'POST /warm?ticket=', ws: 'GET /ws?ticket= (Upgrade)' },
      });
    }

    // Everything below requires a valid ticket.
    const ticket = await verifyTicket(
      url.searchParams.get('ticket') ||
        request.headers.get('x-agent-ticket'),
      env.CC_AGENT_TICKET_SECRET,
    );
    if (!ticket) return json({ error: 'unauthorized: invalid or expired ticket' }, 401);

    // Pre-warm: boot the container + agent before the user's first turn so
    // the perceived cold start is ~zero.
    if (request.method === 'POST' && url.pathname === '/warm') {
      try {
        const sandbox = sandboxFor(env, ticket.sub);
        await ensureAgentRunning(sandbox, env);
        return json({ warm: true });
      } catch (e) {
        return json({ warm: false, error: (e as Error).message }, 502);
      }
    }

    if (url.pathname === '/ws' || url.pathname.startsWith('/ws/')) {
      try {
        return await handleWs(request, ticket, env);
      } catch (e) {
        return json({ error: (e as Error).message }, 502);
      }
    }

    return json({ error: 'not found' }, 404);
  },
};
