// ============================================================
// MCP runtime client — HTTP-SSE transport.
// ============================================================
// Drives the `mcp-sandbox` Cloudflare container worker, which launches an MCP
// (Model Context Protocol) server over stdio inside the Cloudflare Sandbox SDK,
// performs the MCP handshake, LISTS its tools (inspect) and CALLS a tool (call)
// — streaming progress + results back as SSE.
//
// We POST DIRECTLY to the worker (not through candy-shop-api) — the worker sets
// permissive CORS, so a browser fetch from candy.democra.ai works without an
// intermediate proxy. Mirrors cfN8nClient's SSE-parse → callbacks shape.
//
// Event surface (server → client):
//
//   phase   { phase: 'setup' | 'run' }
//   setup   { ok, ms, command, action, tool? }
//   log     { stage, ... }            ← incremental bridge/server progress
//   tools   { serverInfo, capabilities, tools: [...] }   ← on action="inspect"
//   result  { serverInfo, result }                       ← on action="call"
//   run_ms  { ms }
//   done    { sandboxId, action, exitCode }
//   error   { message, tail? }
//
// Every event payload is JSON.
// ============================================================

/** A single tool descriptor as returned by an MCP server's tools/list. */
export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  [k: string]: unknown;
}

/** Result of an MCP tools/list (inspect). */
export interface McpInspectResult {
  serverInfo?: { name?: string; version?: string } | null;
  capabilities?: Record<string, unknown> | null;
  tools: McpToolDescriptor[];
}

/** Result of an MCP tools/call (call). The `result` mirrors the MCP
 *  CallToolResult shape: { content: [...], isError?: boolean, ... }. */
export interface McpCallResult {
  serverInfo?: { name?: string; version?: string } | null;
  result: unknown;
}

/**
 * Base URL of the mcp-sandbox worker. Overridable via VITE_MCP_SANDBOX_URL;
 * defaults to the deployed public URL.
 */
const MCP_BASE = (
  (import.meta.env.VITE_MCP_SANDBOX_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://mcp-sandbox.candy-shop.workers.dev'
);

/** Each callback fires the instant the event lands — render side appends. */
export interface McpStreamCallbacks {
  /** Coarse phase indicator: 'setup' (boot) → 'run' (bridge). */
  onPhase?: (phase: string, meta?: Record<string, unknown>) => void;
  /** Setup finished (container ready, bridge present). */
  onSetup?: (data: Record<string, unknown>) => void;
  /** Incremental progress from the bridge / MCP server (spawn, connect,
   *  initialized, listTools, callTool, server-stderr, …). */
  onLog?: (data: Record<string, unknown>) => void;
  /** Inspect finished — the server's tool list (+ serverInfo/capabilities). */
  onTools?: (data: McpInspectResult) => void;
  /** Call finished — the tool's result (MCP CallToolResult shape). */
  onResult?: (data: McpCallResult) => void;
  /** Run finished (process exited). */
  onDone?: (data: { sandboxId?: string; action?: string; exitCode?: number }) => void;
  /** Any raw event, for debugging / extension. */
  onEvent?: (event: string, data: unknown) => void;
  /** Fatal error (network, non-2xx, or an `error` event from the worker). */
  onError?: (err: Error) => void;
}

/**
 * Best-effort pre-warm of the sandbox container so the first inspect/call skips
 * the cold boot (container provision + MCP toolchain resident). Non-fatal.
 */
export async function warmMcp(): Promise<void> {
  try {
    await fetch(`${MCP_BASE}/warm`, { method: 'GET' }).catch(() => {});
  } catch {
    /* best-effort */
  }
}

/** Shared SSE driver: POST /run, parse the SSE stream into callbacks. */
async function streamMcpRun(
  body: { command: string; action: 'inspect' | 'call'; tool?: string; args?: Record<string, unknown> },
  cb: McpStreamCallbacks,
): Promise<void> {
  let r: Response;
  try {
    r = await fetch(`${MCP_BASE}/run`, {
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
    const e = new Error(`MCP Sandbox failed (${r.status}): ${text.slice(0, 200)}`);
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
          case 'log':
            cb.onLog?.(parsed as Record<string, unknown>);
            break;
          case 'tools':
            cb.onTools?.(parsed as McpInspectResult);
            break;
          case 'result':
            cb.onResult?.(parsed as McpCallResult);
            break;
          case 'run_ms':
            // timing hint — surface via onEvent only
            break;
          case 'done':
            cb.onDone?.(parsed as { sandboxId?: string; action?: string; exitCode?: number });
            break;
          case 'error': {
            const d = parsed as { message?: string; tail?: string };
            const msg = d?.message || 'MCP run failed';
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

/**
 * Inspect an MCP server: handshake + tools/list.
 *
 * @param params.command  the server launch string, e.g.
 *                         "npx -y @modelcontextprotocol/server-everything"
 *                         or "uvx mcp-server-time". Must start with npx/uvx/…
 * @param cb               streaming callbacks (onTools fires with the tool list).
 */
export async function inspectMcp(
  params: { command: string },
  cb: McpStreamCallbacks = {},
): Promise<void> {
  return streamMcpRun({ command: params.command, action: 'inspect' }, cb);
}

/**
 * Call a tool on an MCP server: handshake + tools/call.
 *
 * @param params.command  the server launch string (see inspectMcp).
 * @param params.tool     the tool name to invoke.
 * @param params.args     the tool arguments object.
 * @param cb              streaming callbacks (onResult fires with the result).
 */
export async function callMcpTool(
  params: { command: string; tool: string; args?: Record<string, unknown> },
  cb: McpStreamCallbacks = {},
): Promise<void> {
  return streamMcpRun(
    { command: params.command, action: 'call', tool: params.tool, args: params.args ?? {} },
    cb,
  );
}
