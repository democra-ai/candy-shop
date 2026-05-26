// ============================================================
// Candy Shop · TEE Skill Runtime — Tier 2 entrypoint
// ============================================================
// Runs inside a Phala CVM / AWS Nitro / GCP Confidential Space.
// Exposes POST /invoke where the skill prompt is applied to user
// input and forwarded to an LLM provider. The prompt is never
// returned, logged, or reflected in any response.
// ============================================================

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8080);
const TEE_PROVIDER = process.env.TEE_PROVIDER || 'phala';
const PLATFORM_SIGNING_KEY = process.env.TEE_PLATFORM_SIGNING_KEY || '';
// Optional: PEM-encoded ed25519 public key (TEE_PLATFORM_ED25519_PUBKEY).
// When set, the CVM will verify platform requests using ed25519 instead of HMAC.
const PLATFORM_ED25519_PUB = process.env.TEE_PLATFORM_ED25519_PUBKEY || '';
let _edPubKey = null;
function edPubKey() {
  if (_edPubKey !== null) return _edPubKey;
  if (!PLATFORM_ED25519_PUB) return (_edPubKey = false);
  try {
    _edPubKey = crypto.createPublicKey({
      key: PLATFORM_ED25519_PUB.includes('BEGIN') ? PLATFORM_ED25519_PUB : Buffer.from(PLATFORM_ED25519_PUB, 'base64'),
      format: PLATFORM_ED25519_PUB.includes('BEGIN') ? 'pem' : 'der',
      type: 'spki',
    });
    return _edPubKey;
  } catch (err) {
    console.error('Invalid TEE_PLATFORM_ED25519_PUBKEY:', err.message);
    return (_edPubKey = false);
  }
}
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.anthropic.com/v1/messages';
const LLM_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-6';

const skill = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'skill.json'), 'utf8'));
const CODE_HASH = fs.readFileSync(path.join(process.cwd(), 'code_hash.txt'), 'utf8').trim();

// ── Platform request verification ───────────────────────────
// Rejects any request that wasn't signed by the Candy Shop platform
// with the shared HMAC key. In production this would be ed25519 with
// per-skill rotating keys; HMAC keeps the template minimal.

function verifyPlatformSig(bodyRaw, nonce, sig, alg) {
  // Dev mode: if no keys configured at all, accept anything
  if (!PLATFORM_SIGNING_KEY && !edPubKey()) return true;
  if (!sig || !nonce) return false;

  if (alg === 'ed25519') {
    const pub = edPubKey();
    if (!pub) return false;
    try {
      return crypto.verify(null, Buffer.from(bodyRaw + nonce), pub, Buffer.from(sig, 'base64'));
    } catch { return false; }
  }

  // Default: HMAC-SHA256 (alg=hmac-sha256 or unset for backward compat)
  if (!PLATFORM_SIGNING_KEY) return false;
  const expected = crypto.createHmac('sha256', PLATFORM_SIGNING_KEY).update(bodyRaw + nonce).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

// ── Attestation ─────────────────────────────────────────────
// In a real Phala CVM deployment, this would call the dstack agent:
//   http://localhost:8090/attestation/quote?user_data=<nonce>
// For AWS Nitro: nsm_get_attestation_doc().
// The template returns a structured placeholder so the platform
// can wire the real source once the deploy target is chosen.

// ── Phala dstack integration ────────────────────────────────
// When deployed to a Phala CVM, the dstack guest agent exposes a local
// RPC endpoint for generating TDX quotes. We try (in order):
//   1. Unix socket   /var/run/dstack.sock  (Phala default)
//   2. HTTP          http://localhost:8090/prpc/Tappd.TdxQuote?json
//   3. Stub          (dev / non-TEE environments)
// The nonce is bound into the quote via report_data (sha512 → first 64 bytes).

import { request as httpRequest } from 'node:http';

// Production CVM exposes /var/run/dstack.sock; Phala simulator exposes tappd.sock
// under ~/.phala-cloud/simulator/<ver>/. Set DSTACK_SOCK to override.
const DSTACK_SOCK = process.env.DSTACK_SOCK || '/var/run/dstack.sock';
const DSTACK_TAPPD_SOCK = process.env.DSTACK_TAPPD_SOCK || '';
const DSTACK_HTTP = process.env.DSTACK_HTTP || 'http://localhost:8090';

function reportData(nonce) {
  // 64-byte user_data binding the quote to our nonce
  return crypto.createHash('sha512').update(String(nonce)).digest('hex');
}

function postUnixSocket(socketPath, path, body) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      socketPath, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 3000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(text)); } catch { resolve({ raw: text }); }
        } else reject(new Error(`dstack socket ${res.statusCode}: ${text.slice(0, 120)}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('dstack socket timeout')); });
    req.write(body); req.end();
  });
}

async function trySocket(sockPath, userData) {
  try {
    await fs.promises.access(sockPath);
  } catch { return null; }
  try {
    return await postUnixSocket(sockPath, '/prpc/Tappd.TdxQuote?json',
      JSON.stringify({ report_data: userData }));
  } catch (err) {
    console.warn(`[tee-runtime] ${sockPath} unavailable:`, err.message);
    return null;
  }
}

async function tryDstackSocket(userData) {
  // Try configured tappd.sock first (simulator), then dstack.sock (production CVM)
  if (DSTACK_TAPPD_SOCK) {
    const q = await trySocket(DSTACK_TAPPD_SOCK, userData);
    if (q) return q;
  }
  return await trySocket(DSTACK_SOCK, userData);
}

async function tryDstackHttp(userData) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`${DSTACK_HTTP}/prpc/Tappd.TdxQuote?json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_data: userData }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function getAttestation(nonce) {
  const userData = reportData(nonce);

  // Real Phala dstack quote (production path)
  if (TEE_PROVIDER === 'phala') {
    const quote = (await tryDstackSocket(userData)) || (await tryDstackHttp(userData));
    if (quote) {
      return {
        codeHash: CODE_HASH,
        provider: 'phala',
        payload: {
          nonce,
          reportData: userData,
          quote: quote.quote || quote,           // hex-encoded TDX quote
          eventLog: quote.event_log || null,
          vmConfigHash: quote.vm_config_hash || null,
        },
        signature: quote.signature || undefined,
        verifiedAt: new Date().toISOString(),
      };
    }
    console.warn('[tee-runtime] dstack unreachable — falling back to stub attestation');
  }

  // Stub (dev, smoke test, non-TEE hosts)
  return {
    codeHash: CODE_HASH,
    provider: TEE_PROVIDER,
    payload: {
      nonce,
      reportData: userData,
      mrEnclave: process.env.TEE_MR_ENCLAVE || null,
      mrSigner:  process.env.TEE_MR_SIGNER  || null,
      note: 'Stub attestation — no TEE agent reachable. Use only for dev.',
    },
    verifiedAt: new Date().toISOString(),
  };
}

// ── Skill execution ─────────────────────────────────────────

async function runSkill(input) {
  if (!LLM_API_KEY) {
    return { output: '[LLM_API_KEY not set — running in dry mode]', input };
  }

  const body = {
    model: LLM_MODEL,
    max_tokens: skill.maxTokens || 1024,
    system: skill.systemPrompt,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  };

  const r = await fetch(LLM_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': LLM_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`LLM provider ${r.status}: ${text.slice(0, 200)}`);
  }

  const data = await r.json();
  return { output: data?.content?.[0]?.text ?? data };
}

// ── HTTP surface ────────────────────────────────────────────

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return send(res, 200, { ok: true, codeHash: CODE_HASH, provider: TEE_PROVIDER });
    }

    if (req.method === 'GET' && req.url === '/attestation') {
      const nonce = crypto.randomUUID();
      return send(res, 200, await getAttestation(nonce));
    }

    if (req.method === 'POST' && req.url === '/invoke') {
      const bodyRaw = await readBody(req);
      const nonce = req.headers['x-nonce'];
      const sig = req.headers['x-platform-signature'];
      const alg = req.headers['x-platform-sig-alg'] || 'hmac-sha256';

      if (!verifyPlatformSig(bodyRaw, nonce, sig, alg)) {
        return send(res, 401, { error: 'Invalid platform signature' });
      }

      const { skillId, input } = JSON.parse(bodyRaw);
      if (skillId !== skill.id) {
        return send(res, 400, { error: `Skill ID mismatch: this CVM serves ${skill.id}` });
      }

      const result = await runSkill(input);
      const attestation = await getAttestation(nonce);
      return send(res, 200, { result, attestation });
    }

    send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[tee-runtime]', err?.message || err);
    send(res, 500, { error: err?.message || 'Internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`[tee-runtime] skill=${skill.id} provider=${TEE_PROVIDER} listening on :${PORT}`);
  console.log(`[tee-runtime] codeHash=${CODE_HASH}`);
});
