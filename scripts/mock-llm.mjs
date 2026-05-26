#!/usr/bin/env node
// ============================================================
// Mock OpenAI-compatible LLM for local Tier-1 BYOK smoke testing.
// ============================================================
//   POST /v1/chat/completions  → SSE stream of OpenAI-style deltas
// Echoes the user message back as the response so the test can
// assert the prompt actually reached the "third-party provider".
// ============================================================

import http from 'node:http';

const PORT = Number(process.env.PORT || 9999);

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') return res.end('ok');
  if (req.method !== 'POST' || !req.url.endsWith('/chat/completions')) {
    res.statusCode = 404; return res.end('not found');
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { res.statusCode = 400; return res.end('bad json'); }

  const userMsg = body.messages?.find(m => m.role === 'user')?.content ?? '';
  const sysMsg = body.messages?.find(m => m.role === 'system')?.content ?? '';

  // Sanity: assert auth header was forwarded (BYOK plumbing)
  const auth = req.headers['authorization'] || '';
  console.log(`[mock-llm] auth: ${auth.slice(0, 12)}… sys: ${sysMsg.slice(0, 30)}… usr: ${userMsg.slice(0, 30)}…`);

  res.setHeader('content-type', 'text/event-stream');
  res.setHeader('cache-control', 'no-store');

  const reply = `mock-llm echoes: ${userMsg}`;
  for (const ch of reply) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`);
    await new Promise(r => setTimeout(r, 1));
  }
  res.write(`data: ${JSON.stringify({ usage: { prompt_tokens: 42, completion_tokens: reply.length } })}\n\n`);
  res.write(`data: [DONE]\n\n`);
  res.end();
});

server.listen(PORT, () => console.log(`[mock-llm] listening on http://localhost:${PORT}`));
