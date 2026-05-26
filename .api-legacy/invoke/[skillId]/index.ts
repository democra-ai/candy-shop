// ============================================================
// LEGACY ROUTE — proxies to Worker /api/skill/:id/run
// ============================================================
// The historical Vercel + Supabase invocation gateway was replaced
// by the Cloudflare Worker (worker/src/index.ts) which owns auth,
// entitlements, BYOK, TEE dispatch, and direct LLM streaming.
//
// This shim exists so any agent or bookmarked client that still
// hits the old URL (https://candy.democra.ai/api/invoke/:skillId)
// keeps working. It forwards the body, streams SSE back, and
// preserves cookies so the Worker can resolve the caller's session.
// ============================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

const WORKER_BASE =
  process.env.WORKER_BASE_URL ||
  'https://candy-shop-api.tao-shen.workers.dev';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, Cookie');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { skillId } = req.query;
  const body = req.body || {};

  // Map legacy { callerId, input } → new { input } (Worker derives caller
  // from session cookie). If body.input is missing we still pass it through
  // so the Worker reports a 400 rather than this shim silently 200ing.
  const forwardBody: Record<string, unknown> = {
    input: typeof body.input === 'string' ? body.input : JSON.stringify(body.input ?? ''),
  };
  if (body.model) forwardBody.model = body.model;
  if (body.byokProvider) forwardBody.byokProvider = body.byokProvider;

  const upstream = await fetch(`${WORKER_BASE}/api/skill/${encodeURIComponent(skillId as string)}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Forward auth cookie and bearer if present so the Worker session resolves.
      ...(req.headers.cookie ? { 'cookie': req.headers.cookie as string } : {}),
      ...(req.headers.authorization ? { 'authorization': req.headers.authorization as string } : {}),
      ...(req.headers['x-payment'] ? { 'x-payment': req.headers['x-payment'] as string } : {}),
    },
    body: JSON.stringify(forwardBody),
  });

  // Pipe SSE / JSON straight through.
  const contentType = upstream.headers.get('content-type') || 'application/json';
  res.status(upstream.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');

  if (!upstream.body) {
    res.end();
    return;
  }
  // Node 18+ Vercel runtime: ReadableStream is iterable.
  const reader = upstream.body.getReader();
  // @ts-expect-error VercelResponse extends ServerResponse; chunked write is supported.
  res.flushHeaders?.();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}
