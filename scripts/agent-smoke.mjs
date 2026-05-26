#!/usr/bin/env node
// End-to-end smoke test for the persistent Claude Code agent.
//
//   node scripts/agent-smoke.mjs https://candy-shop-api.<subdomain>.workers.dev
//
// Flow: guest session → mint ticket → open WS → send one turn →
// assert we get streamed deltas + a final result. Exits non-zero on
// failure so it can gate a deploy.

const api = (process.argv[2] || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const fail = (m) => { console.error('✗', m); process.exit(1); };
const ok = (m) => console.log('✓', m);

// 1. guest session (capture cookie)
const g = await fetch(`${api}/api/auth/guest`, { method: 'POST' });
if (!g.ok) fail(`guest session failed: ${g.status}`);
const cookie = (g.headers.get('set-cookie') || '').split(';')[0];
if (!cookie) fail('no session cookie returned');
ok('guest session');

// 2. mint ticket
const t = await fetch(`${api}/api/cc/ticket`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie },
  body: JSON.stringify({ skill: 'smoke' }),
});
if (!t.ok) fail(`ticket denied: ${t.status} ${await t.text()}`);
const { ticket, agentUrl } = await t.json();
if (!ticket || !agentUrl) fail('ticket response missing fields');
ok(`ticket minted (agent: ${agentUrl})`);

// 3. open WS
const u = new URL(agentUrl);
u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
u.pathname = u.pathname.replace(/\/+$/, '') + '/ws';
u.search = `?ticket=${encodeURIComponent(ticket)}`;

const ws = new WebSocket(u.toString());
let sawDelta = false;
let sawResult = false;
const deadline = setTimeout(() => fail('timeout (120s) without a result'), 120_000);

ws.addEventListener('open', () => ok('websocket open'));
ws.addEventListener('error', () => fail('websocket error'));
ws.addEventListener('close', () => {
  if (!sawResult) fail('socket closed before result');
});
ws.addEventListener('message', (ev) => {
  let m;
  try { m = JSON.parse(ev.data); } catch { return; }
  if (m.type === 'ready') {
    ok('agent ready — sending turn');
    ws.send(JSON.stringify({ type: 'user', text: 'Reply with exactly: candy works' }));
  } else if (m.type === 'stream_event') {
    sawDelta = true;
  } else if (m.type === 'result') {
    sawResult = true;
    clearTimeout(deadline);
    if (!sawDelta) fail('no streamed deltas before result');
    ok(`result (${m.subtype || 'success'})`);
    ok('SMOKE PASSED');
    ws.close();
    process.exit(0);
  } else if (m.type === 'error') {
    fail(`agent error: ${m.message}`);
  }
});
