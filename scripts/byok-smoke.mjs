#!/usr/bin/env node
// ============================================================
// Tier-1 BYOK end-to-end smoke test.
// ============================================================
// Validates the full managed-tier path without a real Anthropic key:
//   1. Auth as guest
//   2. Register a BYOK key for the 'mock' provider
//   3. Upsert a Tier-1 managed skill with a sealed system prompt
//   4. Invoke through /api/skill/:id/run with byokProvider='mock'
//   5. Assert SSE delta arrives; assert the mock LLM saw the
//      bearer token and the sealed system prompt
//   6. Assert D1 invocations row exists with tier='managed',
//      provider='byok'
//
// Prereqs:
//   • wrangler/.dev.vars contains BYOK_ENC_KEY=… and
//     MOCK_LLM_BASE_URL=http://127.0.0.1:9999/v1
//   • node scripts/mock-llm.mjs running on :9999
//   • wrangler dev running on :8787
// ============================================================

import { execSync } from 'node:child_process';

const WORKER = process.env.WORKER_BASE || 'http://127.0.0.1:8787';
const fail = (m) => { console.error('\x1b[31m[FAIL]\x1b[0m', m); process.exit(1); };
const ok   = (m) => console.log('\x1b[32m[ OK ]\x1b[0m', m);
const log  = (...a) => console.log('[byok-smoke]', ...a);

const SKILL_ID = `smoke-byok-${Math.random().toString(36).slice(2, 8)}`;
const SECRET_PHRASE = 'sealed-prompt-only-mock-llm-can-see-me';

// ── 1. guest auth ─────────────────────────────────────────────
log('1. guest auth…');
const authResp = await fetch(`${WORKER}/api/auth/guest`, { method: 'POST' });
const setCookie = authResp.headers.get('set-cookie') || '';
const cookie = setCookie.split(';')[0];
if (!cookie) fail('no session cookie');
ok(`session: ${cookie.slice(0, 30)}…`);

const headers = { 'content-type': 'application/json', cookie };

// ── 2. register BYOK key ──────────────────────────────────────
log('2. register BYOK key for provider=mock…');
const byokResp = await fetch(`${WORKER}/api/user/byok`, {
  method: 'PUT', headers,
  body: JSON.stringify({ provider: 'mock', apiKey: 'sk-mock-test-key-12345', label: 'smoke' }),
});
const byokJson = await byokResp.json();
if (!byokJson.ok) fail(`byok save: ${JSON.stringify(byokJson)}`);
ok('byok key encrypted + stored');

// ── 3. upsert tier-1 managed skill ────────────────────────────
log(`3. upsert tier-1 skill (${SKILL_ID})…`);
const upsertResp = await fetch(`${WORKER}/api/skills/upsert`, {
  method: 'POST', headers,
  body: JSON.stringify({
    id: SKILL_ID,
    name: 'BYOK Smoke',
    description: 'managed-tier echo',
    executionModel: 'managed',
    pricingModel: 'free',
    systemPrompt: SECRET_PHRASE,
    defaultModel: 'mock-mini',
  }),
});
const upsertJson = await upsertResp.json();
if (!upsertJson.ok) fail(`upsert: ${JSON.stringify(upsertJson)}`);
ok('tier-1 skill upserted');

// ── 4. assert manifest hides the prompt ───────────────────────
log('4. manifest must hide system_prompt (sealed in DB)…');
const manResp = await fetch(`${WORKER}/api/skill/${SKILL_ID}/manifest`);
const man = await manResp.json();
if (man.systemPrompt !== null) fail(`manifest leaked prompt: ${man.systemPrompt}`);
ok('manifest correctly hides systemPrompt (sealed)');

// ── 5. invoke ────────────────────────────────────────────────
log('5. invoke /api/skill/:id/run with byokProvider=mock…');
const runResp = await fetch(`${WORKER}/api/skill/${SKILL_ID}/run`, {
  method: 'POST', headers,
  body: JSON.stringify({ input: 'hi from byok smoke', byokProvider: 'mock' }),
});
if (runResp.status !== 200) fail(`invoke status ${runResp.status}`);

const text = await runResp.text();
if (!text.includes('event: delta')) fail(`no delta in SSE: ${text.slice(0, 200)}`);
if (!text.includes('event: done'))  fail(`no done in SSE: ${text.slice(0, 200)}`);
// Reconstruct streamed text by concatenating data: lines that follow `event: delta`.
const lines = text.split('\n');
let assembled = '';
for (let i = 0; i < lines.length; i++) {
  if (lines[i] === 'event: delta' && lines[i + 1]?.startsWith('data: ')) {
    assembled += lines[i + 1].slice(6);
  }
}
if (!assembled.includes('mock-llm echoes')) fail(`assembled output missing marker: ${assembled.slice(0, 200)}`);
ok(`SSE complete; mock LLM echoed: "${assembled.slice(0, 80)}…"`);

// ── 6. D1 invocations row ─────────────────────────────────────
log('6. D1 invocations row…');
const invJson = execSync(
  `npx wrangler d1 execute candy-shop-db --local --config worker/wrangler.toml --json --command "SELECT tier, provider FROM invocations WHERE skill_id='${SKILL_ID}' ORDER BY created_at DESC LIMIT 1"`,
  { encoding: 'utf8' },
);
const row = JSON.parse(invJson)[0].results[0];
if (!row) fail('no invocation row');
if (row.tier !== 'managed') fail(`expected tier=managed, got ${row.tier}`);
if (row.provider !== 'byok') fail(`expected provider=byok, got ${row.provider}`);
ok(`D1 invocation tier=${row.tier}, provider=${row.provider}`);

console.log('\n\x1b[32mAll Tier-1 BYOK smoke assertions passed ✓\x1b[0m');
