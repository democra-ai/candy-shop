#!/usr/bin/env node
// ============================================================
// TEE Live Demo — full pipeline against local simulator + live Supabase
// ============================================================
// 1. Ensures Phala simulator is running (starts if needed)
// 2. Spawns the tee-template with the real dstack socket
// 3. Inserts a tier-2 skill into live Supabase
// 4. Exercises the same platform code path as /api/invoke:
//      - signs the request (HMAC)
//      - calls the TEE
//      - verifies the returned attestation (intel strategy)
//      - records the attestation in tee_attestations
//      - links it to the skills row
// 5. Reads back the row from Supabase to prove it was written
// 6. Shuts everything down cleanly
// ============================================================

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const REPO = path.resolve(import.meta.dirname, '..');
const TEE_DIR = path.join(REPO, 'tee-template');
const SIM_SOCK = path.join(os.homedir(), '.phala-cloud/simulator/0.5.3/tappd.sock');
const PORT = 8080;
const PROJECT_REF = 'ygecdbbtzbsoimuljyoc';

function section(msg) { process.stderr.write(`\n\x1b[1;36m━━ ${msg} ━━\x1b[0m\n`); }
function ok(msg)      { process.stderr.write(`\x1b[1;32m✓\x1b[0m ${msg}\n`); }
function info(msg)    { process.stderr.write(`  ${msg}\n`); }
function fail(msg)    { process.stderr.write(`\x1b[1;31m✗\x1b[0m ${msg}\n`); process.exit(1); }

// ── Resolve Supabase PAT from keychain ─────────────────────
let PAT = process.env.SUPABASE_ACCESS_TOKEN;
if (!PAT) {
  try {
    const raw = execSync('security find-generic-password -s "Supabase CLI" -a "supabase" -w', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    PAT = raw.startsWith('go-keyring-base64:') ? Buffer.from(raw.slice('go-keyring-base64:'.length), 'base64').toString() : raw;
  } catch { /* no PAT */ }
}
if (!PAT) fail('No Supabase PAT (run: supabase login, or export SUPABASE_ACCESS_TOKEN)');

async function sqlQuery(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

// ── 1. Ensure simulator is up ──────────────────────────────
section('1. Phala TEE simulator');
if (!existsSync(SIM_SOCK)) fail(`simulator socket missing: ${SIM_SOCK}\nrun: phala simulator start`);
ok(`simulator socket: ${SIM_SOCK}`);

// ── 2. Build skill.json + code_hash.txt, spawn template ────
section('2. TEE runtime (tee-template)');
const SKILL_ID = crypto.randomUUID();
const SIGNING_KEY = crypto.randomBytes(32).toString('hex');

const skill = JSON.parse(await fs.readFile(path.join(TEE_DIR, 'skill.example.json'), 'utf8'));
skill.id = SKILL_ID;
skill.name = 'Candy Shop Live TEE Demo';
skill.systemPrompt = 'You are a confidential demo assistant running inside a Phala TEE. Keep answers to one sentence.';
await fs.writeFile(path.join(TEE_DIR, 'skill.json'), JSON.stringify(skill, null, 2));

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const files = { 'server.js': null, 'skill.json': null, 'package.json': null };
for (const f of Object.keys(files)) files[f] = await fs.readFile(path.join(TEE_DIR, f));
const combined = Object.entries(files).map(([n, b]) => `${sha(b)}  ${n}\n`).join('');
const CODE_HASH = crypto.createHash('sha256').update(combined).digest('hex');
await fs.writeFile(path.join(TEE_DIR, 'code_hash.txt'), CODE_HASH + '\n');
info(`skill id:  ${SKILL_ID}`);
info(`code hash: ${CODE_HASH}`);

const cvm = spawn(process.execPath, ['server.js'], {
  cwd: TEE_DIR,
  env: {
    ...process.env,
    PORT: String(PORT),
    TEE_PLATFORM_SIGNING_KEY: SIGNING_KEY,
    TEE_PROVIDER: 'phala',
    DSTACK_TAPPD_SOCK: SIM_SOCK,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
cvm.stderr.on('data', (d) => process.stderr.write(`  [cvm] ${d}`));

async function waitHealthy() {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/health`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('tee-template did not come up');
}

try {
  await waitHealthy();
  ok(`tee-template listening on http://localhost:${PORT}`);

  // ── 3. Insert tier-2 skill into live Supabase ────────────
  section('3. Insert tier-2 skill into live Supabase');
  await sqlQuery(`
    insert into public.skills (id, name, description, pricing_model, price_amount, price_currency,
      execution_model, manifest_visibility,
      tee_provider, tee_endpoint, tee_code_hash, tee_attestation_url)
    values ('${SKILL_ID}', 'Candy Shop Live TEE Demo',
      'End-to-end demo: real dstack quote, verified intel strategy, attestation logged',
      'free', 0, 'usd', 'tee', 'manifest_only',
      'phala', 'http://localhost:${PORT}', '${CODE_HASH}',
      'http://localhost:${PORT}/attestation');
  `);
  ok(`INSERT skills WHERE id='${SKILL_ID}' (execution_model='tee')`);

  // ── 4. Exercise platform invoke path ─────────────────────
  section('4. Platform invoke → TEE → verify → persist');
  const { verifyAttestation } = await import(path.join(REPO, 'server/lib/tee-verifier.js'));

  const nonce = crypto.randomUUID();
  const body = JSON.stringify({ skillId: SKILL_ID, input: { q: 'Who are you?' }, callerId: 'live-demo-user', nonce });
  const sig = crypto.createHmac('sha256', SIGNING_KEY).update(body + nonce).digest('hex');
  info(`signing: HMAC-SHA256, nonce=${nonce.slice(0, 8)}…`);

  const r = await fetch(`http://localhost:${PORT}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Platform-Signature': sig, 'X-Platform-Sig-Alg': 'hmac-sha256', 'X-Nonce': nonce },
    body,
  });
  if (r.status !== 200) fail(`invoke returned ${r.status}: ${await r.text()}`);
  const invoked = await r.json();
  ok('TEE responded with result + attestation');
  info(`  codeHash: ${invoked.attestation.codeHash}`);
  info(`  provider: ${invoked.attestation.provider}`);
  info(`  quote length: ${invoked.attestation.payload.quote.length / 2} bytes (real TDX v4)`);
  info(`  payload keys: ${Object.keys(invoked.attestation.payload).join(', ')}`);

  // Run the actual platform verifier (intel strategy)
  process.env.TEE_VERIFIER = 'intel';
  const verdict = await verifyAttestation({
    attestation: invoked.attestation,
    expectedCodeHash: CODE_HASH,
    nonce,
  });
  if (!verdict.valid) fail(`verifier rejected: ${verdict.reasons.join('; ')}`);
  ok(`verifier(intel): valid=true — ${Object.entries(verdict.checks).filter(([_, v]) => v).map(([k]) => k).join(', ')}`);

  // Persist attestation to Supabase — same thing server/lib/tee-proxy.ts would do
  section('5. Persist attestation in Supabase');
  const payloadJson = JSON.stringify(invoked.attestation.payload).replace(/'/g, "''");
  const rows = await sqlQuery(`
    insert into public.tee_attestations (skill_id, code_hash, provider, payload, valid, verifier)
    values ('${SKILL_ID}', '${CODE_HASH}', 'phala', '${payloadJson}'::jsonb, true, 'platform:intel')
    returning id, verified_at;
  `);
  const attId = rows[0].id;
  ok(`INSERT tee_attestations → ${attId}`);

  await sqlQuery(`update public.skills set tee_last_verified_at=now() where id='${SKILL_ID}';`);
  ok(`UPDATE skills SET tee_last_verified_at=now()`);

  // ── 6. Read back the evidence ────────────────────────────
  section('6. Evidence in live Supabase');
  const readback = await sqlQuery(`
    select s.id as skill_id, s.name, s.execution_model, s.tee_provider, s.tee_code_hash,
           s.tee_last_verified_at,
           a.id as attestation_id, a.valid, a.verifier, a.verified_at,
           jsonb_path_query_first(a.payload, '$.quote') is not null as has_quote,
           length(a.payload->>'quote')/2 as quote_bytes
    from public.skills s
    left join public.tee_attestations a on a.skill_id = s.id
    where s.id = '${SKILL_ID}';
  `);
  console.log('\n' + JSON.stringify(readback, null, 2));

  // ── 7. Cleanup ───────────────────────────────────────────
  section('7. Cleanup');
  await sqlQuery(`delete from public.skills where id='${SKILL_ID}';`);
  ok(`DELETE skills WHERE id='${SKILL_ID}' (cascades attestations)`);

  section('✅ Live TEE demo complete');
  info(`Real TDX v4 quote: ✓`);
  info(`Intel verifier accepted: ✓`);
  info(`Attestation persisted in Supabase: ✓`);
  info(`Supabase row cleaned up: ✓`);
} finally {
  cvm.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 100));
  // keep simulator running (cheap to restart)
}
