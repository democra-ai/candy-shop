// End-to-end TEE roundtrip test — no DB, no platform.
// Spawns the tee-template server, sends a signed /invoke request through the
// verifier, asserts the attestation matches what the platform expects.
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyAttestation } from '../lib/tee-verifier.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEE_DIR = path.resolve(HERE, '../../tee-template');
const PORT = 18080;
const SKILL_ID = crypto.randomUUID();
const HMAC_KEY = crypto.randomBytes(32).toString('hex');

// Generate ed25519 keypair for the ed25519 path
const { privateKey: edPriv, publicKey: edPub } = crypto.generateKeyPairSync('ed25519');
const edPrivPem = edPriv.export({ type: 'pkcs8', format: 'pem' }).toString();
const edPubPem = edPub.export({ type: 'spki', format: 'pem' }).toString();

async function waitHealthy(url: string, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`TEE template did not come up on ${url}`);
}

async function runWithServer<T>(env: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  // Swap the skill.id in skill.example.json → skill.json
  const fs = await import('node:fs/promises');
  const ex = JSON.parse(await fs.readFile(path.join(TEE_DIR, 'skill.example.json'), 'utf8'));
  ex.id = SKILL_ID;
  await fs.writeFile(path.join(TEE_DIR, 'skill.json'), JSON.stringify(ex, null, 2));
  const shasum = (buf: Buffer) => crypto.createHash('sha256').update(buf).digest('hex');
  const line = (name: string, data: Buffer) => `${shasum(data)}  ${name}\n`;
  const [sv, sk, pk] = await Promise.all([
    fs.readFile(path.join(TEE_DIR, 'server.js')),
    fs.readFile(path.join(TEE_DIR, 'skill.json')),
    fs.readFile(path.join(TEE_DIR, 'package.json')),
  ]);
  const combined = line('server.js', sv) + line('skill.json', sk) + line('package.json', pk);
  const codeHashHex = crypto.createHash('sha256').update(combined).digest('hex');
  await fs.writeFile(path.join(TEE_DIR, 'code_hash.txt'), codeHashHex + '\n');

  const child: ChildProcess = spawn(process.execPath, ['server.js'], {
    cwd: TEE_DIR,
    env: { ...process.env, PORT: String(PORT), ...env },
    stdio: 'pipe',
  });
  child.stderr?.on('data', (d) => process.stderr.write(`[tee] ${d}`));

  try {
    await waitHealthy(`http://localhost:${PORT}/health`);
    return await fn();
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 50));
  }
}

function signHmac(body: string, nonce: string, key: string) {
  return crypto.createHmac('sha256', key).update(body + nonce).digest('hex');
}

function signEd25519(body: string, nonce: string) {
  return crypto.sign(null, Buffer.from(body + nonce), edPriv).toString('base64');
}

async function invoke(alg: string, sigFn: (body: string, nonce: string) => string) {
  const nonce = crypto.randomUUID();
  const body = JSON.stringify({ skillId: SKILL_ID, input: { hello: 'world' }, callerId: 'test', nonce });
  const sig = sigFn(body, nonce);
  const r = await fetch(`http://localhost:${PORT}/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Platform-Signature': sig,
      'X-Platform-Sig-Alg': alg,
      'X-Nonce': nonce,
    },
    body,
  });
  return { nonce, status: r.status, json: await r.json().catch(() => null) };
}

// ── Test cases ──────────────────────────────────────────────

async function run() {
  // 1. HMAC auth path
  await runWithServer({ TEE_PLATFORM_SIGNING_KEY: HMAC_KEY, TEE_PROVIDER: 'phala' }, async () => {
    const { nonce, status, json } = await invoke('hmac-sha256', (b, n) => signHmac(b, n, HMAC_KEY));
    if (status !== 200) throw new Error(`HMAC path: expected 200, got ${status}`);
    if (!json?.attestation?.codeHash) throw new Error('HMAC path: missing attestation.codeHash');
    if (json.attestation.payload.nonce !== nonce) throw new Error('HMAC path: nonce not echoed');
    console.log('✓ HMAC signing works, codeHash =', json.attestation.codeHash.slice(0, 16), '…');

    // Run through platform verifier (local strategy)
    const verdict = await verifyAttestation({
      attestation: json.attestation,
      expectedCodeHash: json.attestation.codeHash,
      nonce,
    });
    if (!verdict.valid) throw new Error(`verifier rejected: ${verdict.reasons.join('; ')}`);
    console.log('✓ verifier(local) accepts valid attestation');

    // Tamper the codeHash → verifier must reject
    const tampered = { ...json.attestation, codeHash: 'deadbeef' + json.attestation.codeHash.slice(8) };
    const bad = await verifyAttestation({ attestation: tampered, expectedCodeHash: json.attestation.codeHash, nonce });
    if (bad.valid) throw new Error('verifier should have rejected tampered codeHash');
    console.log('✓ verifier rejects tampered codeHash:', bad.reasons.find(r => r.includes('codeHash')));

    // Wrong HMAC signature → 401
    const { status: badStatus } = await invoke('hmac-sha256', () => 'not-a-valid-sig');
    if (badStatus !== 401) throw new Error(`bad sig: expected 401, got ${badStatus}`);
    console.log('✓ TEE rejects bad HMAC signature (401)');
  });

  // 2. ed25519 auth path
  await runWithServer({ TEE_PLATFORM_ED25519_PUBKEY: edPubPem, TEE_PROVIDER: 'phala' }, async () => {
    const { nonce, status, json } = await invoke('ed25519', signEd25519);
    if (status !== 200) throw new Error(`ed25519 path: expected 200, got ${status}, body=${JSON.stringify(json)}`);
    if (json.attestation.payload.nonce !== nonce) throw new Error('ed25519 path: nonce not echoed');
    console.log('✓ ed25519 signing works');

    // Wrong ed25519 signature → 401
    const { status: badStatus } = await invoke('ed25519', () => Buffer.alloc(64).toString('base64'));
    if (badStatus !== 401) throw new Error(`bad ed25519: expected 401, got ${badStatus}`);
    console.log('✓ TEE rejects bad ed25519 signature (401)');
  });

  console.log('\nAll TEE roundtrip tests passed.');
}

run().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});

void edPrivPem;
