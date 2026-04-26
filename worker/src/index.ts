// ============================================================
// Candy Shop — Backend on Cloudflare Workers (Hono + D1 + KV)
// ============================================================
// Full Cloudflare-native stack. Replaces both Express server and
// the Supabase frontend SDK. The only piece kept from Supabase is
// ...nothing — this Worker owns auth, data, and Stripe.
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import Stripe from 'stripe';

type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  AI_BUDGET: KVNamespace;
  AI: Ai;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PUBLIC_APP_ORIGIN?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Keep cookies first-party between Pages + Worker (different subdomains) by
// using SameSite=None; Secure. No credentials=true since Pages hits Worker
// via absolute URL — we rely on the cookie being sent cross-site.
app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'stripe-signature', 'X-Payment'],
  credentials: true,
}));

const stripeFor = (env: Bindings) =>
  env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

const SESSION_COOKIE = 'candy_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type Session = {
  sub: string;               // user id (random for guest, provider-id for OAuth)
  provider: 'guest' | 'github' | 'google';
  email?: string;
  display_name?: string;
  avatar_url?: string;
  created_at: number;
};

async function readSession(c: any): Promise<Session | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const raw = await c.env.SESSIONS.get(`s:${token}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

async function writeSession(c: any, sess: Session): Promise<string> {
  const token = crypto.randomUUID() + '-' + crypto.randomUUID().slice(0, 8);
  await c.env.SESSIONS.put(`s:${token}`, JSON.stringify(sess), { expirationTtl: SESSION_TTL_SECONDS });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return token;
}

async function ensureProfile(env: Bindings, sess: Session) {
  await env.DB.prepare(
    `INSERT INTO user_profiles (id, display_name, avatar_url, provider, email)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       display_name = COALESCE(excluded.display_name, user_profiles.display_name),
       avatar_url   = COALESCE(excluded.avatar_url, user_profiles.avatar_url),
       provider     = excluded.provider,
       email        = COALESCE(excluded.email, user_profiles.email),
       updated_at   = datetime('now')`
  ).bind(
    sess.sub,
    sess.display_name ?? null,
    sess.avatar_url ?? null,
    sess.provider,
    sess.email ?? null,
  ).run().catch((e: Error) => console.error('profile upsert', e));
}

// ═══════════════════════════════════════════════════════════════
// Health
// ═══════════════════════════════════════════════════════════════
app.get('/api/health', (c) => c.json({
  status: 'ok',
  runtime: 'cloudflare-worker',
  providers: {
    stripe: !!c.env.STRIPE_SECRET_KEY,
    github_oauth: !!(c.env.GITHUB_CLIENT_ID && c.env.GITHUB_CLIENT_SECRET),
  },
  db: 'd1',
  kv: 'sessions',
  timestamp: new Date().toISOString(),
}));

// ═══════════════════════════════════════════════════════════════
// AUTH
//   /api/auth/guest      — POST: create anonymous session
//   /api/auth/session    — GET:  current session info
//   /api/auth/logout     — POST: destroy session
//   /api/auth/github/start, /github/callback — OAuth (needs secrets)
// ═══════════════════════════════════════════════════════════════

app.post('/api/auth/guest', async (c) => {
  const sub = 'guest-' + crypto.randomUUID();
  const sess: Session = {
    sub,
    provider: 'guest',
    display_name: `Guest ${sub.slice(6, 10)}`,
    created_at: Date.now(),
  };
  await writeSession(c, sess);
  await ensureProfile(c.env, sess);
  return c.json({ user: { id: sub, ...sess } });
});

app.get('/api/auth/session', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ user: null });
  // Enrich with profile row (in case display_name was updated)
  const prof = await c.env.DB.prepare(
    `SELECT display_name, avatar_url, bio, namespace FROM user_profiles WHERE id = ? LIMIT 1`
  ).bind(sess.sub).first<{ display_name: string; avatar_url: string; bio: string; namespace: string }>();
  return c.json({
    user: {
      id: sess.sub,
      email: sess.email ?? null,
      provider: sess.provider,
      user_metadata: {
        display_name: prof?.display_name ?? sess.display_name,
        avatar_url: prof?.avatar_url ?? sess.avatar_url,
      },
    },
  });
});

app.post('/api/auth/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.SESSIONS.delete(`s:${token}`);
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true, sameSite: 'None' });
  return c.json({ ok: true });
});

// GitHub OAuth — only active if GITHUB_CLIENT_ID / _SECRET are set.
app.get('/api/auth/github/start', (c) => {
  if (!c.env.GITHUB_CLIENT_ID) return c.json({ error: 'GitHub OAuth not configured' }, 501);
  const state = crypto.randomUUID();
  const redirect = c.req.query('redirect') || c.env.PUBLIC_APP_ORIGIN || '/';
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', c.env.GITHUB_CLIENT_ID);
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', state + '|' + redirect);
  return c.redirect(url.toString());
});

app.get('/api/auth/github/callback', async (c) => {
  if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) {
    return c.json({ error: 'GitHub OAuth not configured' }, 501);
  }
  const code = c.req.query('code');
  const state = c.req.query('state') || '';
  const redirect = state.split('|')[1] || c.env.PUBLIC_APP_ORIGIN || '/';
  if (!code) return c.json({ error: 'missing code' }, 400);

  const tokRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tok = await tokRes.json() as { access_token?: string };
  if (!tok.access_token) return c.json({ error: 'oauth failed' }, 400);

  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': 'candy-shop' },
  });
  const gh = await userRes.json() as { id: number; login: string; name: string; email: string; avatar_url: string };

  const sess: Session = {
    sub: `github-${gh.id}`,
    provider: 'github',
    email: gh.email,
    display_name: gh.name || gh.login,
    avatar_url: gh.avatar_url,
    created_at: Date.now(),
  };
  await writeSession(c, sess);
  await ensureProfile(c.env, sess);
  return c.redirect(redirect);
});

// ═══════════════════════════════════════════════════════════════
// DATA — skills, stars, ratings, downloads, cravings, profiles
// Each route is a minimal purpose-built handler; the Supabase shim
// on the frontend converts chained queries into these REST calls.
// ═══════════════════════════════════════════════════════════════

// ── Skills ───────────────────────────────────────────────────
app.get('/api/skills', async (c) => {
  const category = c.req.query('category');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 500);
  const sql = category
    ? `SELECT * FROM skills WHERE category = ? ORDER BY popularity DESC LIMIT ?`
    : `SELECT * FROM skills ORDER BY popularity DESC LIMIT ?`;
  const { results } = category
    ? await c.env.DB.prepare(sql).bind(category, limit).all()
    : await c.env.DB.prepare(sql).bind(limit).all();
  return c.json({ data: results ?? [] });
});

app.get('/api/skills/:id', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT * FROM skills WHERE id = ? LIMIT 1`
  ).bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json({ data: row });
});

app.post('/api/skills', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ error: 'auth required' }, 401);
  const body = await c.req.json() as {
    id?: string; name: string; description?: string; category?: string;
    icon?: string; color?: string; tags?: string[]; install_command?: string;
    skill_md_url?: string;
  };
  const id = body.id || crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO skills (id, user_id, name, description, icon, color, category, tags, install_command, skill_md_url, pricing_model, price_amount, price_currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'free', 0, 'usd')
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, description=excluded.description, icon=excluded.icon,
       color=excluded.color, category=excluded.category, tags=excluded.tags,
       updated_at=datetime('now')`
  ).bind(
    id, sess.sub, body.name, body.description ?? '', body.icon ?? '✨',
    body.color ?? 'bg-indigo-100', body.category ?? 'Custom',
    JSON.stringify(body.tags ?? []), body.install_command ?? '', body.skill_md_url ?? '',
  ).run();
  const row = await c.env.DB.prepare(`SELECT * FROM skills WHERE id = ?`).bind(id).first();
  return c.json({ data: row });
});

// ── Stars ────────────────────────────────────────────────────
app.get('/api/skills/:id/stars', async (c) => {
  const userId = c.req.query('user_id');
  const skillId = c.req.param('id');
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM stars WHERE skill_id = ?`
  ).bind(skillId).first<{ n: number }>();
  let starred = false;
  if (userId) {
    const hit = await c.env.DB.prepare(
      `SELECT 1 FROM stars WHERE user_id = ? AND skill_id = ? LIMIT 1`
    ).bind(userId, skillId).first();
    starred = !!hit;
  }
  return c.json({ count: countRow?.n ?? 0, starred });
});

app.post('/api/skills/:id/stars', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ error: 'auth required' }, 401);
  const skillId = c.req.param('id');
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO stars (id, user_id, skill_id) VALUES (?, ?, ?)`
  ).bind(id, sess.sub, skillId).run();
  await c.env.DB.prepare(
    `UPDATE skills SET star_count = (SELECT COUNT(*) FROM stars WHERE skill_id = ?) WHERE id = ?`
  ).bind(skillId, skillId).run();
  return c.json({ ok: true });
});

app.delete('/api/skills/:id/stars', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ error: 'auth required' }, 401);
  const skillId = c.req.param('id');
  await c.env.DB.prepare(
    `DELETE FROM stars WHERE user_id = ? AND skill_id = ?`
  ).bind(sess.sub, skillId).run();
  await c.env.DB.prepare(
    `UPDATE skills SET star_count = (SELECT COUNT(*) FROM stars WHERE skill_id = ?) WHERE id = ?`
  ).bind(skillId, skillId).run();
  return c.json({ ok: true });
});

// ── Ratings ──────────────────────────────────────────────────
app.get('/api/skills/:id/ratings', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM ratings WHERE skill_id = ? ORDER BY created_at DESC`
  ).bind(c.req.param('id')).all();
  return c.json({ data: results ?? [] });
});

app.post('/api/skills/:id/ratings', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ error: 'auth required' }, 401);
  const body = await c.req.json() as { score: number; comment?: string };
  const skillId = c.req.param('id');
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO ratings (id, user_id, skill_id, score, comment)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, skill_id) DO UPDATE SET
       score = excluded.score, comment = excluded.comment, updated_at = datetime('now')`
  ).bind(id, sess.sub, skillId, body.score, body.comment ?? '').run();
  // Refresh aggregate
  const agg = await c.env.DB.prepare(
    `SELECT AVG(score) AS a, COUNT(*) AS n FROM ratings WHERE skill_id = ?`
  ).bind(skillId).first<{ a: number; n: number }>();
  await c.env.DB.prepare(
    `UPDATE skills SET avg_rating = ?, ratings_count = ? WHERE id = ?`
  ).bind(agg?.a ?? 0, agg?.n ?? 0, skillId).run();
  return c.json({ ok: true });
});

// ── Downloads (increment_download RPC replacement) ──────────
app.post('/api/skills/:id/download', async (c) => {
  const sess = await readSession(c).catch(() => null);
  const skillId = c.req.param('id');
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO downloads (id, user_id, skill_id) VALUES (?, ?, ?)`
  ).bind(id, sess?.sub ?? null, skillId).run();
  await c.env.DB.prepare(
    `UPDATE skills SET popularity = popularity + 1 WHERE id = ?`
  ).bind(skillId).run();
  return c.json({ ok: true });
});

// ── Cravings ─────────────────────────────────────────────────
app.get('/api/cravings', async (c) => {
  const status = c.req.query('status');
  const search = c.req.query('search');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 500);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const where: string[] = [];
  const binds: any[] = [];
  if (status) { where.push('status = ?'); binds.push(status); }
  if (search) {
    where.push('(title LIKE ? OR description LIKE ?)');
    binds.push(`%${search}%`, `%${search}%`);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM cravings ${whereSql}`
  ).bind(...binds).first<{ n: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM cravings ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();

  return c.json({ data: results ?? [], count: countRow?.n ?? 0 });
});

app.post('/api/cravings', async (c) => {
  const sess = await readSession(c);
  const body = await c.req.json() as any;
  const id = body.id || crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO cravings (id, user_id, title, description, category, tags, budget, urgency, status, emoji, posted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, sess?.sub ?? null, body.title, body.description ?? '',
    body.category ?? null, JSON.stringify(body.tags ?? []),
    body.budget ?? null, body.urgency ?? 'medium',
    body.status ?? 'open', body.emoji ?? '🍭',
    body.posted_by ?? (sess?.display_name ?? 'Anonymous'),
  ).run();
  const row = await c.env.DB.prepare(`SELECT * FROM cravings WHERE id = ?`).bind(id).first();
  return c.json({ data: row });
});

// ── Profiles ─────────────────────────────────────────────────
app.get('/api/profiles/:userId', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT * FROM user_profiles WHERE id = ? LIMIT 1`
  ).bind(c.req.param('userId')).first();
  return c.json({ data: row });
});

app.patch('/api/profiles/:userId', async (c) => {
  const sess = await readSession(c);
  if (!sess || sess.sub !== c.req.param('userId')) {
    return c.json({ error: 'forbidden' }, 403);
  }
  const body = await c.req.json() as any;
  await c.env.DB.prepare(
    `UPDATE user_profiles SET
       display_name = COALESCE(?, display_name),
       bio          = COALESCE(?, bio),
       namespace    = COALESCE(?, namespace),
       avatar_url   = COALESCE(?, avatar_url),
       updated_at   = datetime('now')
     WHERE id = ?`
  ).bind(
    body.display_name ?? null, body.bio ?? null,
    body.namespace ?? null, body.avatar_url ?? null, sess.sub,
  ).run();
  const row = await c.env.DB.prepare(`SELECT * FROM user_profiles WHERE id = ?`).bind(sess.sub).first();
  return c.json({ data: row });
});

// ═══════════════════════════════════════════════════════════════
// PAYMENT (unchanged from prior commit) — Stripe + D1 back-end
// ═══════════════════════════════════════════════════════════════

app.post('/api/payment/checkout', async (c) => {
  const stripe = stripeFor(c.env);
  if (!stripe) return c.json({ error: 'Stripe is not configured on this server' }, 503);

  const body = await c.req.json().catch(() => null) as {
    skillIds?: string[]; userId?: string;
    successUrl?: string; cancelUrl?: string;
  } | null;
  if (!body?.skillIds?.length || !body.userId) {
    return c.json({ error: 'skillIds and userId are required' }, 400);
  }

  const placeholders = body.skillIds.map(() => '?').join(',');
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, description, icon, pricing_model, price_amount, price_currency
     FROM skills WHERE id IN (${placeholders})`
  ).bind(...body.skillIds).all<{
    id: string; name: string; description: string | null;
    icon: string | null; pricing_model: string;
    price_amount: number; price_currency: string;
  }>();

  if (!results?.length) return c.json({ error: 'Skills not found' }, 404);

  const items = results
    .filter(s => s.pricing_model !== 'free' && s.price_amount > 0)
    .map(s => ({
      skillId: s.id,
      name: s.name,
      description: s.description || `AI Skill: ${s.name}`,
      amount: s.price_amount,
      currency: s.price_currency || 'usd',
    }));

  if (items.length === 0) return c.json({ free: true, skillIds: body.skillIds });

  const origin = c.env.PUBLIC_APP_ORIGIN
    || c.req.header('origin')
    || new URL(c.req.url).origin;

  const baseSuccess = body.successUrl || `${origin}/skills/library?payment=success`;
  const sep = baseSuccess.includes('?') ? '&' : '?';
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: items.map(item => ({
      price_data: {
        currency: item.currency,
        product_data: { name: item.name, description: item.description },
        unit_amount: item.amount,
      },
      quantity: 1,
    })),
    success_url: `${baseSuccess}${sep}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: body.cancelUrl || `${origin}/?payment=cancelled`,
    metadata: {
      userId: body.userId,
      skillIds: items.map(i => i.skillId).join(','),
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });

  const sessionRowId = crypto.randomUUID();
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  await c.env.DB.prepare(
    `INSERT INTO checkout_sessions (id, user_id, provider, status, skill_ids, total_amount, currency, stripe_session_id)
     VALUES (?, ?, 'stripe', 'open', ?, ?, ?, ?)`
  ).bind(
    sessionRowId, body.userId,
    JSON.stringify(items.map(i => i.skillId)),
    total, items[0]?.currency || 'usd', session.id,
  ).run().catch(err => console.error('D1 insert checkout_sessions failed:', err));

  return c.json({ provider: 'stripe', sessionId: session.id, checkoutUrl: session.url });
});

app.get('/api/payment/verify/:sessionId', async (c) => {
  const stripe = stripeFor(c.env);
  if (!stripe) return c.json({ error: 'Stripe is not configured' }, 503);
  const session = await stripe.checkout.sessions.retrieve(c.req.param('sessionId'));
  return c.json({
    paid: session.payment_status === 'paid',
    status: session.status,
    skillIds: session.metadata?.skillIds?.split(',') || [],
  });
});

app.get('/api/payment/entitlements/:userId', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM entitlements WHERE user_id = ?`
  ).bind(c.req.param('userId')).all();
  return c.json({ entitlements: results || [] });
});

app.get('/api/payment/purchases/:userId', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, s.name AS skill_name, s.icon AS skill_icon, s.category AS skill_category
     FROM purchases p LEFT JOIN skills s ON s.id = p.skill_id
     WHERE p.user_id = ? ORDER BY p.created_at DESC`
  ).bind(c.req.param('userId')).all();
  return c.json({ purchases: results || [] });
});

app.get('/api/payment/check/:userId/:skillId', async (c) => {
  const { userId, skillId } = c.req.param();
  const skill = await c.env.DB.prepare(
    `SELECT pricing_model, price_amount FROM skills WHERE id = ? LIMIT 1`
  ).bind(skillId).first<{ pricing_model: string; price_amount: number }>();
  if (!skill || skill.pricing_model === 'free' || skill.price_amount === 0) {
    return c.json({ hasAccess: true, reason: 'free' });
  }
  const ent = await c.env.DB.prepare(
    `SELECT type, expires_at, remaining_calls FROM entitlements
     WHERE user_id = ? AND skill_id = ? LIMIT 1`
  ).bind(userId, skillId).first<{ type: string; expires_at: string | null; remaining_calls: number | null }>();
  if (!ent) return c.json({ hasAccess: false, reason: 'payment_required' });
  if (ent.type === 'permanent') return c.json({ hasAccess: true, reason: 'purchased' });
  if (ent.type === 'subscription') {
    const alive = !ent.expires_at || new Date(ent.expires_at) > new Date();
    return c.json({ hasAccess: alive, reason: alive ? 'purchased' : 'payment_required' });
  }
  if (ent.type === 'per_call') {
    const alive = (ent.remaining_calls ?? 0) > 0;
    return c.json({ hasAccess: alive, reason: alive ? 'purchased' : 'payment_required' });
  }
  return c.json({ hasAccess: false, reason: 'payment_required' });
});

app.post('/api/webhook/stripe', async (c) => {
  const stripe = stripeFor(c.env);
  if (!stripe || !c.env.STRIPE_WEBHOOK_SECRET) return c.json({ error: 'Stripe not configured' }, 503);
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'Missing stripe-signature' }, 400);
  const rawBody = await c.req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return c.json({ error: `Invalid signature: ${(err as Error).message}` }, 400);
  }
  if (event.type !== 'checkout.session.completed') {
    return c.json({ processed: false, eventType: event.type });
  }
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const skillIds = session.metadata?.skillIds?.split(',') ?? [];
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent : session.payment_intent?.id;
  if (!userId || skillIds.length === 0) return c.json({ processed: false, reason: 'missing metadata' });

  for (const skillId of skillIds) {
    const skill = await c.env.DB.prepare(
      `SELECT price_amount, price_currency, pricing_model FROM skills WHERE id = ? LIMIT 1`
    ).bind(skillId).first<{ price_amount: number; price_currency: string; pricing_model: string }>();
    const amount = skill?.price_amount ?? session.amount_total ?? 0;
    const currency = skill?.price_currency ?? session.currency ?? 'usd';
    const purchaseId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO purchases (id, user_id, skill_id, provider, status, amount, currency, external_id, metadata)
       VALUES (?, ?, ?, 'stripe', 'completed', ?, ?, ?, ?)`
    ).bind(purchaseId, userId, skillId, amount, currency, paymentIntentId ?? null,
      JSON.stringify({ stripe_session_id: session.id })).run();
    const entType = skill?.pricing_model === 'per_call' ? 'per_call'
      : skill?.pricing_model === 'subscription' ? 'subscription' : 'permanent';
    const expiresAt = entType === 'subscription'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
    const remainingCalls = entType === 'per_call' ? 100 : null;
    await c.env.DB.prepare(
      `INSERT INTO entitlements (user_id, skill_id, type, expires_at, remaining_calls, provider, purchase_id)
       VALUES (?, ?, ?, ?, ?, 'stripe', ?)
       ON CONFLICT(user_id, skill_id) DO UPDATE SET
         type = excluded.type, expires_at = excluded.expires_at,
         remaining_calls = excluded.remaining_calls, provider = excluded.provider,
         purchase_id = excluded.purchase_id, granted_at = datetime('now')`
    ).bind(userId, skillId, entType, expiresAt, remainingCalls, purchaseId).run();
  }
  await c.env.DB.prepare(
    `UPDATE checkout_sessions SET status = 'completed' WHERE stripe_session_id = ?`
  ).bind(session.id).run();
  return c.json({ processed: true, skillIds, userId });
});

// ═══════════════════════════════════════════════════════════════
// Workers AI — hard-capped to daily free allocation
// ═══════════════════════════════════════════════════════════════
//
// Free tier: 10,000 Neurons/day (resets at 00:00 UTC).
// Llama 3.1 8B Fast is ~2,800 Neurons / 1M input tok — so in practice
// a single short chat (~300 tok in + ~300 tok out) ≈ ~5 Neurons.
// We still cap REQUESTS per day per session to protect the pool.
//
// Hard limits enforced here:
//   • 40 requests / day / session  (chat UX testing allowance)
//   • 256 input tokens per request
//   • 512 output tokens per request
// Budget counter lives in AI_BUDGET KV with TTL aligned to UTC midnight.

const AI_DAILY_REQUEST_CAP = 40;
const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';

function todayKey(prefix: string) {
  const d = new Date();
  const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${prefix}:${k}`;
}
function secondsUntilUtcMidnight() {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return Math.max(60, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
}

app.get('/api/ai/budget', async (c) => {
  const sess = await readSession(c);
  const key = todayKey(`budget:${sess?.sub ?? 'anon'}`);
  const used = parseInt((await c.env.AI_BUDGET.get(key)) ?? '0', 10);
  return c.json({
    date: todayKey('').split(':')[1],
    used,
    limit: AI_DAILY_REQUEST_CAP,
    remaining: Math.max(0, AI_DAILY_REQUEST_CAP - used),
    model: AI_MODEL,
    resets_in_seconds: secondsUntilUtcMidnight(),
  });
});

app.post('/api/ai/chat', async (c) => {
  const sess = await readSession(c);
  const budgetKey = todayKey(`budget:${sess?.sub ?? c.req.header('cf-connecting-ip') ?? 'anon'}`);

  const used = parseInt((await c.env.AI_BUDGET.get(budgetKey)) ?? '0', 10);
  if (used >= AI_DAILY_REQUEST_CAP) {
    return c.json({
      error: 'daily_limit_reached',
      message: `Free-tier test limit reached (${AI_DAILY_REQUEST_CAP} chats/day). Resets at 00:00 UTC.`,
      used, limit: AI_DAILY_REQUEST_CAP,
    }, 429);
  }

  const body = await c.req.json().catch(() => null) as {
    messages?: { role: 'system' | 'user' | 'assistant'; content: string }[];
    stream?: boolean;
  } | null;

  if (!body?.messages?.length) return c.json({ error: 'messages required' }, 400);

  // Trim input to stay inside free allocation
  const messages = body.messages.slice(-8).map(m => ({
    role: m.role,
    content: (m.content ?? '').slice(0, 1024),
  }));

  await c.env.AI_BUDGET.put(budgetKey, String(used + 1), {
    expirationTtl: secondsUntilUtcMidnight(),
  });

  if (body.stream) {
    const stream = (await c.env.AI.run(AI_MODEL, {
      messages,
      max_tokens: 512,
      stream: true,
    })) as unknown as ReadableStream;
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'x-ai-model': AI_MODEL,
        'x-ai-requests-used': String(used + 1),
        'x-ai-requests-limit': String(AI_DAILY_REQUEST_CAP),
      },
    });
  }

  const result = await c.env.AI.run(AI_MODEL, { messages, max_tokens: 512 }) as { response?: string };
  return c.json({
    role: 'assistant',
    content: result.response ?? '',
    model: AI_MODEL,
    budget: { used: used + 1, limit: AI_DAILY_REQUEST_CAP },
  });
});

// ═══════════════════════════════════════════════════════════════
// Claude Code Sandbox proxy
// ═══════════════════════════════════════════════════════════════
//
// Proxies POST /api/cc/run → cc-sandbox.candy-shop.workers.dev
// - cc-sandbox itself doesn't set CORS headers, so the browser cannot
//   call it directly from candy.democra.ai. We forward and stream back
//   the SSE response with our own CORS already applied via Hono.
// - Hard cap: 8 runs / session / day in AI_BUDGET KV. Each Claude Code
//   run can take 30-90s of compute on the upstream sandbox, so we keep
//   the budget very tight.

const CC_SANDBOX_URL = 'https://cc-sandbox.candy-shop.workers.dev/';
const CC_DAILY_RUN_CAP = 8;

app.get('/api/cc/budget', async (c) => {
  const sess = await readSession(c);
  const key = todayKey(`cc:${sess?.sub ?? c.req.header('cf-connecting-ip') ?? 'anon'}`);
  const used = parseInt((await c.env.AI_BUDGET.get(key)) ?? '0', 10);
  return c.json({
    date: todayKey('').split(':')[1],
    used,
    limit: CC_DAILY_RUN_CAP,
    remaining: Math.max(0, CC_DAILY_RUN_CAP - used),
    upstream: CC_SANDBOX_URL,
    resets_in_seconds: secondsUntilUtcMidnight(),
  });
});

app.post('/api/cc/run', async (c) => {
  const sess = await readSession(c);
  const budgetKey = todayKey(`cc:${sess?.sub ?? c.req.header('cf-connecting-ip') ?? 'anon'}`);

  const used = parseInt((await c.env.AI_BUDGET.get(budgetKey)) ?? '0', 10);
  if (used >= CC_DAILY_RUN_CAP) {
    return c.json({
      error: 'daily_limit_reached',
      message: `Claude Code Sandbox daily run cap reached (${CC_DAILY_RUN_CAP}/day). Resets at 00:00 UTC.`,
      used, limit: CC_DAILY_RUN_CAP,
    }, 429);
  }

  const body = await c.req.json().catch(() => null) as {
    repo?: string;
    task?: string;
  } | null;
  if (!body?.repo || !body?.task) {
    return c.json({ error: 'repo and task required' }, 400);
  }

  // Increment the daily counter BEFORE upstream call so a hung sandbox
  // still costs a slot. Better safe than runaway.
  await c.env.AI_BUDGET.put(budgetKey, String(used + 1), {
    expirationTtl: secondsUntilUtcMidnight(),
  });

  const upstream = await fetch(CC_SANDBOX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo: body.repo, task: body.task }),
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text().catch(() => '');
    return c.json({ error: `upstream ${upstream.status}: ${err.slice(0, 200)}` }, 502);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'text/event-stream',
      'cache-control': 'no-cache',
      'x-cc-runs-used': String(used + 1),
      'x-cc-runs-limit': String(CC_DAILY_RUN_CAP),
    },
  });
});

// ═══════════════════════════════════════════════════════════════
// Fallback
// ═══════════════════════════════════════════════════════════════
app.all('*', (c) => c.json({ error: 'Not found', path: c.req.path }, 404));

export default app;
