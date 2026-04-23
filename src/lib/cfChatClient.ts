// ============================================================
// Cloudflare Workers AI client — simple chat, NOT an agent.
// ============================================================
// Bypasses OpenCode entirely. Routes to Worker's /api/ai/chat which
// hard-caps daily usage to stay inside the Workers AI free allocation
// (10,000 Neurons/day). Intended as a "try the built-in CF model"
// toggle — no tool use, no file/shell access, no persistent session.
// ============================================================

// By convention in this repo VITE_PAYMENT_API_URL already includes the
// `/api` suffix (e.g. https://worker.workers.dev/api). When unset we
// fall back to same-origin `/api` so dev proxy + Vercel both work.
const API_BASE =
  (import.meta.env.VITE_PAYMENT_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  '/api';

export interface CFChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CFChatReply {
  content: string;
  model: string;
  budget: { used: number; limit: number };
}

export interface CFBudget {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  model: string;
  resets_in_seconds: number;
}

/** Fetch current daily budget state (no mutation). */
export async function getCFBudget(): Promise<CFBudget | null> {
  try {
    const r = await fetch(`${API_BASE}/ai/budget`, { credentials: 'include' });
    if (!r.ok) return null;
    return await r.json() as CFBudget;
  } catch {
    return null;
  }
}

/** Non-streaming chat. One request in, one assistant message out. */
export async function sendCFChat(messages: CFChatMessage[]): Promise<CFChatReply> {
  const r = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (r.status === 429) {
    const j = await r.json().catch(() => ({})) as { message?: string };
    throw new Error(j.message || 'Daily CF Workers AI budget reached. Resets at 00:00 UTC.');
  }
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`CF chat failed (${r.status}): ${body.slice(0, 200)}`);
  }

  const j = await r.json() as { content: string; model: string; budget: { used: number; limit: number } };
  return j;
}
