#!/usr/bin/env node
// ============================================================
// Stripe webhook smoke test — local D1 + wrangler dev.
// ============================================================
// Synthesizes a checkout.session.completed event, signs it with
// the same HMAC scheme Stripe uses (`Stripe-Signature: t=…,v1=…`),
// posts to the Worker, then asserts that:
//   • the response is 200
//   • a purchases row was inserted
//   • an entitlements row was inserted
//   • /api/payment/check?userId=…&skillId=… returns hasAccess: true
//
// Run wrangler dev first (with the STRIPE_WEBHOOK_SECRET from
// worker/.dev.vars) and have the local D1 migrated.
// ============================================================

import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const WORKER = process.env.WORKER_BASE || 'http://127.0.0.1:8787';
const SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret_for_local_smoke_only';

const USER_ID = `smoke-user-${Math.random().toString(36).slice(2, 10)}`;
const SKILL_ID = 'enterprise-code-review'; // seeded by 0002_seed_skills.sql

// Stripe checkout.session.completed payload — minimum shape the Worker reads.
const session = {
  id: `cs_test_${Math.random().toString(36).slice(2, 14)}`,
  object: 'checkout.session',
  payment_intent: `pi_test_${Math.random().toString(36).slice(2, 14)}`,
  payment_status: 'paid',
  amount_total: 999,
  currency: 'usd',
  metadata: {
    // Worker reads camelCase keys (set at checkout creation time).
    userId: USER_ID,
    skillIds: SKILL_ID,
  },
};

const event = {
  id: `evt_test_${Math.random().toString(36).slice(2, 14)}`,
  object: 'event',
  type: 'checkout.session.completed',
  api_version: '2024-04-10',
  created: Math.floor(Date.now() / 1000),
  data: { object: session },
};

const payload = JSON.stringify(event);
const t = Math.floor(Date.now() / 1000);
const signedPayload = `${t}.${payload}`;
const sig = crypto.createHmac('sha256', SECRET).update(signedPayload).digest('hex');
const stripeSignature = `t=${t},v1=${sig}`;

const log = (...args) => console.log('[stripe-smoke]', ...args);
const fail = (msg) => { console.error('\x1b[31m[FAIL]\x1b[0m', msg); process.exit(1); };
const ok   = (msg) => console.log('\x1b[32m[ OK ]\x1b[0m', msg);

log(`User: ${USER_ID}, Skill: ${SKILL_ID}, Session: ${session.id}`);

// 1. Post webhook
log('1. POST /api/webhook/stripe with signed payload…');
const r = await fetch(`${WORKER}/api/webhook/stripe`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': stripeSignature },
  body: payload,
});
const respText = await r.text();
if (r.status !== 200) fail(`webhook returned ${r.status}: ${respText.slice(0, 200)}`);
ok(`webhook accepted (200): ${respText.slice(0, 100)}`);

// 2. Assert purchases row
log('2. Asserting D1 purchases row…');
const purchasesJson = execSync(
  `npx wrangler d1 execute candy-shop-db --local --config worker/wrangler.toml --json --command "SELECT COUNT(*) AS n FROM purchases WHERE user_id='${USER_ID}' AND skill_id='${SKILL_ID}' AND status='completed'"`,
  { encoding: 'utf8' },
);
const pCount = JSON.parse(purchasesJson)[0].results[0].n;
if (pCount < 1) fail(`expected ≥1 purchase row, got ${pCount}`);
ok(`D1 has ${pCount} purchase row(s)`);

// 3. Assert entitlements row
log('3. Asserting D1 entitlements row…');
const entJson = execSync(
  `npx wrangler d1 execute candy-shop-db --local --config worker/wrangler.toml --json --command "SELECT type, remaining_calls FROM entitlements WHERE user_id='${USER_ID}' AND skill_id='${SKILL_ID}'"`,
  { encoding: 'utf8' },
);
const ent = JSON.parse(entJson)[0].results[0];
if (!ent) fail('no entitlement row found');
ok(`D1 entitlement type=${ent.type}, remaining_calls=${ent.remaining_calls}`);

// 4. Assert /api/payment/check returns hasAccess: true
log('4. Asserting /api/payment/check…');
const checkResp = await fetch(`${WORKER}/api/payment/check/${USER_ID}/${SKILL_ID}`);
const check = await checkResp.json();
if (!check.hasAccess) fail(`payment/check returned ${JSON.stringify(check)}`);
ok(`payment/check: hasAccess=true, reason=${check.reason}`);

console.log('\n\x1b[32mAll Stripe webhook smoke assertions passed ✓\x1b[0m');
