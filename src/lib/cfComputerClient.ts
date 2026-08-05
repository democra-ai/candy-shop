/**
 * cf-computer client — the PERSISTENT skill runtime.
 *
 * Why this exists alongside cfPiClient: Pi runs in a Cloudflare Container that
 * sleeps after 10 minutes, so every run starts from a blank filesystem and any
 * artifact a skill produced is gone. cf-computer (@cloudflare/computer) keeps a
 * skill's files in a Durable Object's SQLite storage, so a skill can READ WHAT
 * IT WROTE LAST TIME.
 *
 * Verified end-to-end against the live worker:
 *   run 1: write  -> /log.md = "run 1"
 *   run 2: read, edit -> /log.md = "run 1\nrun 2"   (separate request)
 *
 * Contract mirrors pi-sandbox's POST /run ({ task, skillMd }) so this is a
 * drop-in alternative backend rather than a new shape to learn.
 */

const COMPUTER_BASE = (
  (import.meta.env.VITE_COMPUTER_URL as string | undefined) ||
  'https://cf-computer.tao-shen.workers.dev'
).replace(/\/+$/, '');

export interface ComputerToolCall {
  tool: string;
  args?: Record<string, unknown>;
}

export interface ComputerRunResult {
  ok: boolean;
  /** The durable workspace this skill owns — stable across runs. */
  workspace?: string;
  model?: string;
  answer?: string;
  steps?: number;
  /** Tools the model was actually offered (diagnostic: proves wiring). */
  toolsOffered?: string[];
  toolCalls?: ComputerToolCall[];
  /** Files present in the workspace AFTER the run. */
  files?: Array<{ name: string; isFile?: boolean; isDirectory?: boolean }> | string[];
  elapsed_ms?: number;
  error?: string;
}

/**
 * Run a skill in its own durable workspace.
 * `skillId` keys the workspace, so the same skill always gets the same files.
 */
export async function runComputerSkill(params: {
  task: string;
  skillId?: string;
  skillMd?: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<ComputerRunResult> {
  try {
    const res = await fetch(`${COMPUTER_BASE}/skill`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        task: params.task,
        skillId: params.skillId,
        skillMd: params.skillMd,
        model: params.model,
      }),
      signal: params.signal,
    });
    const data = (await res.json()) as ComputerRunResult;
    if (!res.ok) return { ok: false, error: data?.error || `HTTP ${res.status}` };
    return data;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Read a file from a skill's durable workspace (e.g. to show past artifacts). */
export async function readComputerFile(
  skillId: string,
  path: string,
): Promise<{ persisted: boolean; content?: string }> {
  try {
    const url = new URL(`${COMPUTER_BASE}/read`);
    url.searchParams.set('ws', `skill-${skillId}`);
    url.searchParams.set('path', path);
    const res = await fetch(url.toString());
    const data = (await res.json()) as { persisted?: boolean; content?: string };
    return { persisted: Boolean(data?.persisted), content: data?.content };
  } catch {
    return { persisted: false };
  }
}

/** List a skill's durable workspace — what survived from previous runs. */
export async function listComputerFiles(skillId: string): Promise<string[]> {
  try {
    const url = new URL(`${COMPUTER_BASE}/ls`);
    url.searchParams.set('ws', `skill-${skillId}`);
    url.searchParams.set('dir', '/');
    const res = await fetch(url.toString());
    const data = (await res.json()) as { entries?: Array<{ name: string }> };
    return (data?.entries ?? []).map((e) => e.name);
  } catch {
    return [];
  }
}
