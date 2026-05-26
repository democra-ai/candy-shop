// ============================================================
// LEGACY ROUTE — proxies GET /api/invoke/:id/manifest to the Worker.
// ============================================================
// The Cloudflare Worker now serves the authoritative manifest from
// D1. This shim keeps the historical Vercel URL working for any
// caller (agents, bookmarks, MCP servers) that points at it.
// ============================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

const WORKER_BASE =
  process.env.WORKER_BASE_URL ||
  'https://candy-shop-api.tao-shen.workers.dev';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { skillId } = req.query;
  const upstream = await fetch(`${WORKER_BASE}/api/skill/${encodeURIComponent(skillId as string)}/manifest`);
  const body = await upstream.text();
  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
  res.send(body);
}
