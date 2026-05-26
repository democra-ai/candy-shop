// Real Phala dstack simulator → template → intel verifier
// Skipped when the simulator isn't running. Start with: `phala simulator start`.
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { verifyAttestation } from '../lib/tee-verifier.js';

const SIM_SOCK = path.join(os.homedir(), '.phala-cloud/simulator/0.5.3/tappd.sock');
if (!existsSync(SIM_SOCK)) {
  console.log('⊘ Simulator not running — skipping. Start with: phala simulator start');
  process.exit(0);
}

const TEE_DIR = path.resolve(import.meta.dirname, '../../tee-template');
const PORT = 18091;
const SKILL_ID = crypto.randomUUID();
const HMAC = crypto.randomBytes(32).toString('hex');

// Prep skill.json + code_hash.txt
const ex = JSON.parse(await fs.readFile(path.join(TEE_DIR, 'skill.example.json'), 'utf8'));
ex.id = SKILL_ID;
await fs.writeFile(path.join(TEE_DIR, 'skill.json'), JSON.stringify(ex, null, 2));
const shasum = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');
const [sv, sk, pk] = await Promise.all([
  fs.readFile(path.join(TEE_DIR, 'server.js')),
  fs.readFile(path.join(TEE_DIR, 'skill.json')),
  fs.readFile(path.join(TEE_DIR, 'package.json')),
]);
await fs.writeFile(path.join(TEE_DIR, 'code_hash.txt'),
  crypto.createHash('sha256').update(`${shasum(sv)}  server.js\n${shasum(sk)}  skill.json\n${shasum(pk)}  package.json\n`).digest('hex') + '\n');

const child: ChildProcess = spawn(process.execPath, ['server.js'], {
  cwd: TEE_DIR,
  env: { ...process.env, PORT: String(PORT), TEE_PLATFORM_SIGNING_KEY: HMAC, TEE_PROVIDER: 'phala', DSTACK_TAPPD_SOCK: SIM_SOCK },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stderr?.on('data', (d) => process.stderr.write(`[tee] ${d}`));

async function waitHealthy() {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/health`)).ok) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('template failed to start');
}

try {
  await waitHealthy();

  const nonce = crypto.randomUUID();
  const body = JSON.stringify({ skillId: SKILL_ID, input: { ping: 1 }, callerId: 'test', nonce });
  const sig = crypto.createHmac('sha256', HMAC).update(body + nonce).digest('hex');
  const r = await fetch(`http://localhost:${PORT}/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Platform-Signature': sig,
      'X-Platform-Sig-Alg': 'hmac-sha256',
      'X-Nonce': nonce,
    },
    body,
  });
  if (r.status !== 200) throw new Error(`invoke returned ${r.status}`);
  const json = await r.json() as { attestation: { codeHash: string; payload: Record<string, unknown> } };

  // Real dstack response must include quote, eventLog, vmConfigHash
  for (const key of ['quote', 'eventLog', 'vmConfigHash', 'nonce', 'reportData']) {
    if (!(key in json.attestation.payload)) throw new Error(`missing payload.${key}`);
  }
  const quoteHex = json.attestation.payload.quote as string;
  if (!quoteHex.startsWith('040002008100')) throw new Error('quote does not have TDX v4 / tee_type=0x81 header');
  console.log('✓ simulator returned real TDX v4 quote (', quoteHex.length / 2, 'bytes)');

  // Intel strategy: parse + nonce binding check must pass against real quote
  process.env.TEE_VERIFIER = 'intel';
  const verdict = await verifyAttestation({
    attestation: json.attestation,
    expectedCodeHash: json.attestation.codeHash,
    nonce,
  });
  if (!verdict.valid) throw new Error(`intel verdict invalid: ${verdict.reasons.join('; ')}`);
  if (!verdict.checks.nonceBinding) throw new Error('intel: nonce binding failed');
  console.log('✓ intel strategy validates real dstack quote (all structural checks pass)');

  // Tamper the quote — verifier must reject
  const tamperedQuote = 'ff'.repeat(32) + quoteHex.slice(64);
  const bad = await verifyAttestation({
    attestation: { ...json.attestation, payload: { ...json.attestation.payload, quote: tamperedQuote } },
    expectedCodeHash: json.attestation.codeHash,
    nonce,
  });
  if (bad.valid) throw new Error('intel should have rejected tampered header');
  console.log('✓ intel rejects tampered quote header:', bad.reasons.find((r) => !r.startsWith('warning:')));

  console.log('\nAll dstack end-to-end tests passed.');
} finally {
  child.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 50));
}
