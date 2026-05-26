#!/usr/bin/env node
// ============================================================
// Local mock TEE CVM for D1 smoke testing.
// ============================================================
// Spins up an HTTP server that mimics a Phala/Nitro CVM:
//   POST /invoke  → { result, attestation: { codeHash, provider, payload, verifiedAt } }
//   GET  /health  → 'ok'
//
// Echoes the platform nonce back inside `attestation.payload.nonce`
// so the Worker's nonce-binding check passes. The codeHash is a
// fixed sha256 of this file so it's stable across runs.
//
// Verifies the platform's HMAC-SHA256 signature when
// TEE_PLATFORM_SIGNING_KEY is set, otherwise accepts unsigned.
// ============================================================

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 8080);
const HMAC_KEY = process.env.TEE_PLATFORM_SIGNING_KEY || '';
const codeHash = crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex');

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') return res.end('ok');
  if (req.method !== 'POST' || req.url !== '/invoke') {
    res.statusCode = 404; return res.end('not found');
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  let body;
  try { body = JSON.parse(raw); } catch { res.statusCode = 400; return res.end('bad json'); }

  // HMAC verify
  if (HMAC_KEY) {
    const sig = req.headers['x-platform-signature'];
    const nonce = req.headers['x-nonce'];
    const expected = crypto.createHmac('sha256', HMAC_KEY).update(raw + nonce).digest('hex');
    if (sig !== expected) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'bad signature' }));
    }
  }

  const result = `[mock-tee] received input: ${JSON.stringify(body.input).slice(0, 200)}`;
  const attestation = {
    codeHash,
    provider: 'phala',
    payload: {
      nonce: body.nonce,           // echo for binding check
      ts: Date.now(),
      mock: true,
    },
    verifiedAt: new Date().toISOString(),
  };

  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ result, attestation }));
});

server.listen(PORT, () => {
  console.log(`[mock-tee] listening on http://localhost:${PORT}`);
  console.log(`[mock-tee] codeHash: ${codeHash}`);
  console.log(`[mock-tee] HMAC verification: ${HMAC_KEY ? 'enabled' : 'disabled (set TEE_PLATFORM_SIGNING_KEY to enable)'}`);
});
