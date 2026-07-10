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
  /** The organization's identity hub. Every product signs users in here. */
  AUTH_HUB_URL?: string;
  /** This product's auth base path at the hub. Candy is a tenant → "/candy/api/auth". */
  AUTH_HUB_PATH?: string;
  AI_BUDGET: KVNamespace;
  AI: Ai;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PUBLIC_APP_ORIGIN?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  // Optional: when both are set, /api/ai/chat is routed to a Worker on the
  // user's `workers-paid` Cloudflare account instead of using this Worker's
  // env.AI binding. That Worker's account has Workers Paid plan, so AI usage
  // exceeds the free 10k Neurons/day instead of being hard-cut.
  AI_PROXY_URL?: string;
  AI_PROXY_SECRET?: string;
  // Tier-1 BYOK: derives an AES-GCM key for encrypting user API keys at rest.
  BYOK_ENC_KEY?: string;
  // Tier-2 TEE: shared HMAC secret for signing platform→CVM requests.
  TEE_PLATFORM_SIGNING_KEY?: string;
  TEE_TIMEOUT_MS?: string;
  // Public URL of the in-repo `agent/` worker (deploys as `cc-sandbox`).
  // Overridable per-environment; default is the workers.dev URL.
  CC_SANDBOX_URL?: string;
  // Shared HMAC secret with the agent worker, used to sign short-lived
  // access tickets. Set via: wrangler secret put CC_AGENT_TICKET_SECRET
  CC_AGENT_TICKET_SECRET?: string;
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
  provider: 'guest' | 'github' | 'google' | 'hub';
  email?: string;
  display_name?: string;
  avatar_url?: string;
  created_at: number;
};

const AUTH_HUB = (env: Bindings) => (env.AUTH_HUB_URL || 'https://auth.democra.ai').replace(/\/+$/, '');
/** Candy's own tenant path at the hub — its session lives under /candy/api/auth, cookie `ba-candy.*`. */
const AUTH_HUB_PATH = (env: Bindings) => (env.AUTH_HUB_PATH || '/candy/api/auth').replace(/\/+$/, '');

/**
 * The organization's identity hub owns every real user (auth.democra.ai).
 * We never mint or store their credentials — we ask the hub who the caller is.
 *
 * Two ways the hub identifies a request, tried in order:
 *   1. the `.democra.ai` SSO cookie, forwarded verbatim (works once this Worker
 *      is served from a *.democra.ai route);
 *   2. an `Authorization: Bearer <token>` the frontend forwards (the hub's
 *      bearer plugin validates it) — the path that works from *.workers.dev.
 *
 * The hub's answer is cached in KV for a minute, keyed by the credential, so a
 * page of API calls costs one round trip rather than one each.
 */
async function readHubSession(c: any): Promise<Session | null> {
  const cookie = c.req.header('cookie') ?? '';
  const bearer = c.req.header('authorization') ?? '';
  const cred = bearer || cookie;
  if (!cred) return null;
  // Nothing that looks like a hub session? Don't pay for a round trip. Matches any
  // "<prefix>session_token" cookie (ba-candy.session_token for the tenant, and the old
  // better-auth.session_token during the cutover).
  if (!bearer && !/(?:^|;\s*)[\w.-]*session_token=/.test(cookie)) return null;

  const key = `hub:${await sha256(cred)}`;
  const cached = await c.env.SESSIONS.get(key);
  if (cached) return cached === 'null' ? null : (JSON.parse(cached) as Session);

  let sess: Session | null = null;
  try {
    const r = await fetch(`${AUTH_HUB(c.env)}${AUTH_HUB_PATH(c.env)}/get-session`, {
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(bearer ? { authorization: bearer } : {}),
        accept: 'application/json',
      },
    });
    if (r.ok) {
      const j = (await r.json()) as { user?: { id: string; email?: string; name?: string; image?: string } } | null;
      if (j?.user?.id) {
        sess = {
          sub: j.user.id,
          provider: 'hub',
          email: j.user.email,
          display_name: j.user.name,
          avatar_url: j.user.image ?? undefined,
          created_at: Date.now(),
        };
      }
    }
  } catch {
    return null; // hub unreachable → fall back to the local session, never 500
  }
  // Cache both hits and misses briefly; a miss is the common unauthenticated case.
  await c.env.SESSIONS.put(key, JSON.stringify(sess), { expirationTtl: 60 });
  return sess;
}

async function sha256(v: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function readSession(c: any): Promise<Session | null> {
  // A signed-in organization user always wins over a local guest session.
  const hub = await readHubSession(c);
  if (hub) return hub;

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

  // The buyer is whoever the session says they are — never a client-supplied id.
  // Trusting userId let a caller bill a purchase to (and grant entitlements
  // to) any account they named, and recorded purchases under an id that the
  // run-time entitlement check never looks up.
  const sess = await readSession(c);
  if (!sess) return c.json({ error: 'sign in to purchase' }, 401);
  const userId = sess.sub;

  const body = await c.req.json().catch(() => null) as {
    skillIds?: string[];
    successUrl?: string; cancelUrl?: string;
  } | null;
  if (!body?.skillIds?.length) {
    return c.json({ error: 'skillIds are required' }, 400);
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
      userId: userId,
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
    sessionRowId, userId,
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

// A caller may only read their OWN entitlements/purchases. The :userId in the path is
// kept for URL compatibility but is authorized against the session, never trusted.
app.get('/api/payment/entitlements/:userId', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ entitlements: [] });
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM entitlements WHERE user_id = ?`
  ).bind(sess.sub).all();
  return c.json({ entitlements: results || [] });
});

app.get('/api/payment/purchases/:userId', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ purchases: [] });
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, s.name AS skill_name, s.icon AS skill_icon, s.category AS skill_category
     FROM purchases p LEFT JOIN skills s ON s.id = p.skill_id
     WHERE p.user_id = ? ORDER BY p.created_at DESC`
  ).bind(sess.sub).all();
  return c.json({ purchases: results || [] });
});

app.get('/api/payment/check/:userId/:skillId', async (c) => {
  const { skillId } = c.req.param();
  const sess = await readSession(c);
  const userId = sess?.sub ?? '';
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

// Higher cap (200) when forwarding to the workers-paid proxy: that account
// has Paid plan so we're not racing the 10k Neurons/day free hard cutoff.
// Falls back to a tighter 40/day when running on local env.AI (Free plan).
const AI_DAILY_REQUEST_CAP_LOCAL = 40;
const AI_DAILY_REQUEST_CAP_PAID = 200;
const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';

// Selectable Workers AI models for the picker (cf-ai runtime). The /api/ai/
// health route probes each so the picker can red/green them; /api/ai/chat
// accepts any id in this allowlist (default = AI_MODEL).
const AI_MODELS = [
  { id: '@cf/meta/llama-3.1-8b-instruct-fast',      label: 'Llama 3.1 8B (fast)', note: 'fastest', default: true },
  { id: '@cf/meta/llama-3.1-8b-instruct',           label: 'Llama 3.1 8B' },
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B' },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct',  label: 'Llama 4 Scout 17B' },
];
const AI_MODEL_IDS = new Set(AI_MODELS.map((m) => m.id));

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

function aiDailyCap(env: Bindings): number {
  return env.AI_PROXY_URL && env.AI_PROXY_SECRET
    ? AI_DAILY_REQUEST_CAP_PAID
    : AI_DAILY_REQUEST_CAP_LOCAL;
}
function aiBackend(env: Bindings): 'workers-paid' | 'local-free' {
  return env.AI_PROXY_URL && env.AI_PROXY_SECRET ? 'workers-paid' : 'local-free';
}

app.get('/api/ai/budget', async (c) => {
  const sess = await readSession(c);
  const key = todayKey(`budget:${sess?.sub ?? 'anon'}`);
  const used = parseInt((await c.env.AI_BUDGET.get(key)) ?? '0', 10);
  const limit = aiDailyCap(c.env);
  return c.json({
    date: todayKey('').split(':')[1],
    used,
    limit,
    remaining: Math.max(0, limit - used),
    model: AI_MODEL,
    backend: aiBackend(c.env),
    resets_in_seconds: secondsUntilUtcMidnight(),
  });
});

app.post('/api/ai/chat', async (c) => {
  const sess = await readSession(c);
  const budgetKey = todayKey(`budget:${sess?.sub ?? c.req.header('cf-connecting-ip') ?? 'anon'}`);
  const limit = aiDailyCap(c.env);

  const used = parseInt((await c.env.AI_BUDGET.get(budgetKey)) ?? '0', 10);
  if (used >= limit) {
    return c.json({
      error: 'daily_limit_reached',
      message: `Daily test limit reached (${limit} chats/day). Resets at 00:00 UTC.`,
      used, limit,
    }, 429);
  }

  const body = await c.req.json().catch(() => null) as {
    messages?: { role: 'system' | 'user' | 'assistant'; content: string }[];
    model?: string;
  } | null;

  if (!body?.messages?.length) return c.json({ error: 'messages required' }, 400);

  // Trim to keep request small regardless of which backend serves it.
  const messages = body.messages.slice(-8).map(m => ({
    role: m.role,
    content: (m.content ?? '').slice(0, 1024),
  }));

  // Selectable model (cf-ai picker) — validated against the allowlist.
  const model = body.model && AI_MODEL_IDS.has(body.model) ? body.model : AI_MODEL;

  await c.env.AI_BUDGET.put(budgetKey, String(used + 1), {
    expirationTtl: secondsUntilUtcMidnight(),
  });

  const backend = aiBackend(c.env);

  if (backend === 'workers-paid') {
    // Forward to the Worker on the workers-paid account.
    const upstream = await fetch(`${c.env.AI_PROXY_URL!.replace(/\/+$/, '')}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': c.env.AI_PROXY_SECRET!,
      },
      body: JSON.stringify({ model, messages, max_tokens: 512 }),
    });
    if (!upstream.ok) {
      const err = await upstream.text().catch(() => '');
      return c.json({ error: `proxy ${upstream.status}: ${err.slice(0, 200)}` }, 502);
    }
    const j = await upstream.json() as { response?: string; usage?: unknown };
    return c.json({
      role: 'assistant',
      content: j.response ?? '',
      model,
      backend,
      budget: { used: used + 1, limit },
    });
  }

  // Local fallback: use this Worker's own env.AI (main account, free plan).
  const result = await c.env.AI.run(model as Parameters<typeof c.env.AI.run>[0], { messages, max_tokens: 512 }) as { response?: string };
  return c.json({
    role: 'assistant',
    content: result.response ?? '',
    model,
    backend,
    budget: { used: used + 1, limit },
  });
});

// Selectable model catalog + per-model health for the picker (cf-ai runtime).
app.get('/api/ai/models', (c) =>
  c.json({ runtime: 'ai', default: AI_MODEL, models: AI_MODELS }),
);

app.get('/api/ai/health', async (c) => {
  const model = c.req.query('model') || AI_MODEL;
  if (!AI_MODEL_IDS.has(model)) return c.json({ model, ok: false, error: 'unknown model' });
  // Probe the SAME backend /api/ai/chat would use, so the picker's red/green
  // reflects where chat actually runs. On a workers-paid deployment the local
  // free binding can be Neuron-capped while the proxy is healthy (and vice
  // versa) — probing the wrong plane would make the lights lie.
  const backend = aiBackend(c.env);
  const started = Date.now();
  try {
    if (backend === 'workers-paid') {
      const r = await fetch(`${c.env.AI_PROXY_URL!.replace(/\/+$/, '')}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-shared-secret': c.env.AI_PROXY_SECRET!,
        },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      });
      return c.json({
        model,
        ok: r.ok,
        latencyMs: Date.now() - started,
        backend,
        ...(r.ok ? {} : { error: `proxy HTTP ${r.status}` }),
      });
    }
    const out = await c.env.AI.run(model as Parameters<typeof c.env.AI.run>[0], {
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    }) as { response?: string };
    return c.json({ model, ok: out != null, latencyMs: Date.now() - started, backend });
  } catch (e) {
    return c.json({
      model,
      ok: false,
      latencyMs: Date.now() - started,
      backend,
      error: e instanceof Error ? e.message : 'probe failed',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// Skill invocation — fast LLM path with 3-tier privacy
// ═══════════════════════════════════════════════════════════════
//
// POST /api/skill/:id/run  { input, model?, byokProvider? }
//
// Tiers (per skill.execution_model):
//   open     — Tier 0: prompt + LLM call run on platform (env.AI / AI_PROXY).
//                       Source is public. Default cheapest path.
//   managed  — Tier 1: prompt sealed in D1, never returned to client.
//                       Platform calls 3rd-party LLM. If the caller has a
//                       BYOK key registered, the call goes out with their
//                       key (so the LLM provider sees prompt but never
//                       caller identity — caller is anonymized at the
//                       network edge). Otherwise the platform key is used.
//   tee      — Tier 2: prompt sealed inside a TEE CVM. We forward, verify
//                       the returned attestation, log it, return result.
//
// All tiers stream SSE: event=delta data="...", final event=done data={...}.

type SkillRow = {
  id: string;
  name: string;
  pricing_model: string;
  price_amount: number;
  execution_model: 'open' | 'managed' | 'tee' | 'federated';
  system_prompt: string | null;
  default_model: string | null;
  tee_provider: string | null;
  tee_endpoint: string | null;
  tee_code_hash: string | null;
  allowed_providers: string | null;
};

async function checkEntitlement(env: Bindings, userId: string, skillId: string, pricingModel: string, priceAmount: number): Promise<{ ok: boolean; reason: string }> {
  if (pricingModel === 'free' || priceAmount === 0) return { ok: true, reason: 'free' };
  const ent = await env.DB.prepare(
    `SELECT type, expires_at, remaining_calls FROM entitlements WHERE user_id = ? AND skill_id = ?`
  ).bind(userId, skillId).first<{ type: string; expires_at: string | null; remaining_calls: number | null }>();
  if (!ent) return { ok: false, reason: 'no_entitlement' };
  if (ent.type === 'permanent') return { ok: true, reason: 'permanent' };
  if (ent.type === 'subscription') {
    const alive = !ent.expires_at || new Date(ent.expires_at).getTime() > Date.now();
    return { ok: alive, reason: alive ? 'subscription' : 'subscription_expired' };
  }
  if (ent.type === 'per_call') {
    if ((ent.remaining_calls ?? 0) > 0) return { ok: true, reason: 'per_call' };
    return { ok: false, reason: 'per_call_exhausted' };
  }
  return { ok: false, reason: 'unknown_entitlement' };
}

async function consumePerCall(env: Bindings, userId: string, skillId: string) {
  await env.DB.prepare(
    `UPDATE entitlements SET remaining_calls = remaining_calls - 1
     WHERE user_id = ? AND skill_id = ? AND type = 'per_call' AND remaining_calls > 0`
  ).bind(userId, skillId).run();
}

// SSE helper — encodes events as text/event-stream frames.
function sseStream(producer: (write: (event: string, data: unknown) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: string, data: unknown) => {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
      };
      try { await producer(write); }
      catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        write('error', { message: msg });
      }
      finally { controller.close(); }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

// ── BYOK encryption (AES-GCM, key derived from env.BYOK_ENC_KEY) ─
async function byokCryptoKey(env: Bindings): Promise<CryptoKey | null> {
  const secret = (env as any).BYOK_ENC_KEY as string | undefined;
  if (!secret) return null;
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptBYOK(env: Bindings, plaintext: string): Promise<string | null> {
  const key = await byokCryptoKey(env);
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const buf = new Uint8Array(iv.length + ct.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...buf));
}

async function decryptBYOK(env: Bindings, ciphertextB64: string): Promise<string | null> {
  const key = await byokCryptoKey(env);
  if (!key) return null;
  try {
    const buf = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
    const iv = buf.slice(0, 12);
    const ct = buf.slice(12);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch { return null; }
}

// ── BYOK routes ───────────────────────────────────────────────
app.put('/api/user/byok', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ error: 'auth_required' }, 401);
  const body = await c.req.json().catch(() => null) as { provider?: string; apiKey?: string; label?: string } | null;
  if (!body?.provider || !body?.apiKey) return c.json({ error: 'provider and apiKey required' }, 400);
  if (!['anthropic', 'openai', 'groq', 'cerebras', 'deepseek', 'zhipu', 'mock', 'workers-ai'].includes(body.provider)) {
    return c.json({ error: 'unsupported provider' }, 400);
  }
  // workers-ai is a virtual provider that uses Cloudflare's free daily
  // Workers AI allocation — no real third-party key required. We still
  // store a marker row so the BYOK flow looks the same end-to-end.
  if (body.provider === 'workers-ai' && body.apiKey === 'use-cf-free-tier') {
    // accepted — marker key
  }
  const ct = await encryptBYOK(c.env, body.apiKey);
  if (!ct) return c.json({ error: 'BYOK_ENC_KEY not configured on this Worker' }, 503);
  await c.env.DB.prepare(
    `INSERT INTO user_byok_keys (user_id, provider, ciphertext, label, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, provider) DO UPDATE SET
       ciphertext = excluded.ciphertext, label = excluded.label, updated_at = datetime('now')`
  ).bind(sess.sub, body.provider, ct, body.label ?? null).run();
  return c.json({ ok: true, provider: body.provider });
});

app.get('/api/user/byok', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ error: 'auth_required' }, 401);
  const { results } = await c.env.DB.prepare(
    `SELECT provider, label, updated_at FROM user_byok_keys WHERE user_id = ?`
  ).bind(sess.sub).all<{ provider: string; label: string | null; updated_at: string }>();
  return c.json({ keys: results || [] });
});

app.delete('/api/user/byok/:provider', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ error: 'auth_required' }, 401);
  await c.env.DB.prepare(
    `DELETE FROM user_byok_keys WHERE user_id = ? AND provider = ?`
  ).bind(sess.sub, c.req.param('provider')).run();
  return c.json({ ok: true });
});

async function getBYOKKey(env: Bindings, userId: string, provider: string): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT ciphertext FROM user_byok_keys WHERE user_id = ? AND provider = ?`
  ).bind(userId, provider).first<{ ciphertext: string }>();
  if (!row) return null;
  return decryptBYOK(env, row.ciphertext);
}

// ── Provider dispatchers (Tier-1) ────────────────────────────
// Stream text deltas via `onDelta`. Returns usage counts.
async function callAnthropic(opts: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userInput: string;
  onDelta: (text: string) => void;
}): Promise<{ inputTokens: number; outputTokens: number }> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.model || 'claude-haiku-4-5',
      max_tokens: 1024,
      system: opts.systemPrompt,
      messages: [{ role: 'user', content: opts.userInput }],
      stream: true,
    }),
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Anthropic ${resp.status}: ${t.slice(0, 200)}`);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let inputTokens = 0, outputTokens = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep;
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, sep); buf = buf.slice(sep + 2);
      const dataLine = block.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) continue;
      const json = dataLine.slice(6);
      if (json === '[DONE]') continue;
      try {
        const e = JSON.parse(json);
        if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
          opts.onDelta(e.delta.text || '');
        } else if (e.type === 'message_start' && e.message?.usage) {
          inputTokens = e.message.usage.input_tokens ?? 0;
        } else if (e.type === 'message_delta' && e.usage?.output_tokens) {
          outputTokens = e.usage.output_tokens;
        }
      } catch { /* skip */ }
    }
  }
  return { inputTokens, outputTokens };
}

async function callOpenAICompatible(opts: {
  apiKey: string;
  baseURL: string;
  model: string;
  systemPrompt: string;
  userInput: string;
  onDelta: (text: string) => void;
}): Promise<{ inputTokens: number; outputTokens: number }> {
  const resp = await fetch(`${opts.baseURL.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userInput },
      ],
      stream: true,
    }),
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => '');
    throw new Error(`${opts.baseURL} ${resp.status}: ${t.slice(0, 200)}`);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let inputTokens = 0, outputTokens = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let sep;
    while ((sep = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, sep); buf = buf.slice(sep + 2);
      const dataLine = block.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) continue;
      const json = dataLine.slice(6);
      if (json === '[DONE]') continue;
      try {
        const e = JSON.parse(json);
        const delta = e.choices?.[0]?.delta?.content;
        if (delta) opts.onDelta(delta);
        if (e.usage) {
          inputTokens = e.usage.prompt_tokens ?? inputTokens;
          outputTokens = e.usage.completion_tokens ?? outputTokens;
        }
      } catch { /* skip */ }
    }
  }
  return { inputTokens, outputTokens };
}

function providerBaseURLs(env: Bindings): Record<string, string> {
  return {
    openai: 'https://api.openai.com/v1',
    groq: 'https://api.groq.com/openai/v1',
    cerebras: 'https://api.cerebras.ai/v1',
    deepseek: 'https://api.deepseek.com/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    // Local dev override — only takes effect when MOCK_LLM_BASE_URL is set
    // (e.g. in worker/.dev.vars). Used by scripts/byok-smoke.mjs.
    ...((env as any).MOCK_LLM_BASE_URL ? { mock: (env as any).MOCK_LLM_BASE_URL as string } : {}),
  };
}

// ── TEE proxy (Tier-2) — mirrors api/invoke/[skillId]/index.ts ─
async function proxyToTEEWorker(env: Bindings, skill: SkillRow, input: unknown, callerId: string): Promise<{ result: string; attestation: any; attestationId: string }> {
  if (!skill.tee_endpoint) throw new Error('Tier-2 skill missing tee_endpoint');
  const nonce = crypto.randomUUID();
  const body = JSON.stringify({ skillId: skill.id, input, callerId, nonce });

  const hmacKey = (env as any).TEE_PLATFORM_SIGNING_KEY as string | undefined;
  let sig = '', alg = 'none';
  if (hmacKey) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(hmacKey),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(body + nonce));
    sig = Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, '0')).join('');
    alg = 'hmac-sha256';
  }
  const timeoutMs = Number((env as any).TEE_TIMEOUT_MS || 30000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(`${skill.tee_endpoint.replace(/\/$/, '')}/invoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Platform-Signature': sig,
        'X-Platform-Sig-Alg': alg,
        'X-Nonce': nonce,
      },
      body, signal: ctrl.signal,
    });
  } finally { clearTimeout(timer); }

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`TEE ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json() as { result: any; attestation: any };
  if (!data.attestation?.codeHash) throw new Error('TEE response missing attestation');

  // Verify codeHash + nonce binding (local strategy)
  const reasons: string[] = [];
  if (skill.tee_code_hash && data.attestation.codeHash !== skill.tee_code_hash) {
    reasons.push(`codeHash mismatch`);
  }
  const echoed = data.attestation.payload?.nonce;
  if (echoed !== nonce) reasons.push('nonce binding failed');
  const valid = reasons.length === 0;

  // Record attestation
  const attestationId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO tee_attestations (id, skill_id, code_hash, provider, payload, signature, valid, verifier)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'platform:local')`
  ).bind(
    attestationId, skill.id, data.attestation.codeHash, data.attestation.provider,
    JSON.stringify(data.attestation.payload), data.attestation.signature ?? null,
    valid ? 1 : 0
  ).run().catch(e => console.error('tee_attestations insert', e));

  if (valid) {
    await env.DB.prepare(
      `UPDATE skills SET tee_last_verified_at = datetime('now') WHERE id = ?`
    ).bind(skill.id).run().catch(() => {});
  } else {
    throw new Error(`TEE attestation rejected: ${reasons.join('; ')}`);
  }

  const result = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
  return { result, attestation: data.attestation, attestationId };
}

// ── GET /api/skill/:id/manifest (public, always visible) ────
// Tier-1/2 skills expose name/description/pricing but never the
// system_prompt. Tier-0 includes systemPrompt so anyone can run it.
app.get('/api/skill/:id/manifest', async (c) => {
  const skill = await c.env.DB.prepare(
    `SELECT id, name, description, category, icon, tags, pricing_model, price_amount,
            price_currency, execution_model, system_prompt, default_model, tee_provider,
            tee_endpoint, tee_code_hash, tee_last_verified_at
     FROM skills WHERE id = ?`
  ).bind(c.req.param('id')).first<{
    id: string; name: string; description: string; category: string | null;
    icon: string | null; tags: string | null; pricing_model: string;
    price_amount: number; price_currency: string;
    execution_model: 'open' | 'managed' | 'tee' | 'federated';
    system_prompt: string | null; default_model: string | null;
    tee_provider: string | null; tee_endpoint: string | null;
    tee_code_hash: string | null; tee_last_verified_at: string | null;
  }>();
  if (!skill) return c.json({ error: 'skill not found' }, 404);

  const exposesPrompt = skill.execution_model === 'open';
  let tags: string[] = [];
  try { tags = skill.tags ? JSON.parse(skill.tags) : []; } catch { /* */ }

  return c.json({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    icon: skill.icon,
    tags,
    pricing: {
      model: skill.pricing_model,
      amount: skill.price_amount,
      currency: skill.price_currency,
    },
    executionModel: skill.execution_model,
    manifestVisibility: exposesPrompt ? 'full' : 'manifest_only',
    systemPrompt: exposesPrompt ? skill.system_prompt : null,
    defaultModel: skill.default_model,
    tee: skill.execution_model === 'tee' ? {
      provider: skill.tee_provider,
      endpoint: skill.tee_endpoint,
      codeHash: skill.tee_code_hash,
      lastVerifiedAt: skill.tee_last_verified_at,
    } : null,
  });
});

// ── POST /api/skills/upsert (creator publish) ────────────────
app.post('/api/skills/upsert', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ error: 'auth_required' }, 401);

  const body = await c.req.json().catch(() => null) as {
    id?: string;
    name?: string;
    description?: string;
    category?: string;
    icon?: string;
    tags?: string[];
    isPublic?: boolean;
    pricingModel?: 'free' | 'one_time' | 'per_call' | 'subscription';
    price?: number;
    executionModel?: 'open' | 'managed' | 'tee';
    systemPrompt?: string;
    defaultModel?: string;
    teeConfig?: {
      provider?: string;
      endpoint?: string;
      codeHash?: string;
    };
  } | null;

  if (!body?.id || !body?.name) return c.json({ error: 'id and name required' }, 400);
  const exec = body.executionModel ?? 'open';
  if (!['open', 'managed', 'tee', 'federated'].includes(exec)) {
    return c.json({ error: 'invalid executionModel' }, 400);
  }
  if (exec === 'tee') {
    if (!body.teeConfig?.provider) return c.json({ error: 'tee skill needs teeConfig.provider' }, 400);
    if (body.teeConfig.codeHash && !/^[0-9a-f]{64}$/i.test(body.teeConfig.codeHash)) {
      return c.json({ error: 'tee_code_hash must be sha256 hex' }, 400);
    }
  }
  if ((exec === 'managed' || exec === 'tee') && !body.systemPrompt && exec !== 'tee') {
    return c.json({ error: 'managed skill needs systemPrompt' }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO skills (id, user_id, name, description, category, icon, tags, is_public,
                         pricing_model, price_amount, price_currency,
                         execution_model, system_prompt, default_model,
                         tee_provider, tee_endpoint, tee_code_hash, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'usd', ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       category = excluded.category,
       icon = excluded.icon,
       tags = excluded.tags,
       is_public = excluded.is_public,
       pricing_model = excluded.pricing_model,
       price_amount = excluded.price_amount,
       execution_model = excluded.execution_model,
       system_prompt = excluded.system_prompt,
       default_model = excluded.default_model,
       tee_provider = excluded.tee_provider,
       tee_endpoint = excluded.tee_endpoint,
       tee_code_hash = excluded.tee_code_hash,
       updated_at = datetime('now')`
  ).bind(
    body.id, sess.sub, body.name, body.description ?? '',
    body.category ?? 'Custom', body.icon ?? '✨',
    JSON.stringify(body.tags ?? []), body.isPublic === false ? 0 : 1,
    body.pricingModel ?? 'free', body.price ?? 0,
    exec,
    exec === 'open' ? (body.systemPrompt ?? null) : (body.systemPrompt ?? null),
    body.defaultModel ?? null,
    exec === 'tee' ? body.teeConfig?.provider ?? null : null,
    exec === 'tee' ? body.teeConfig?.endpoint ?? null : null,
    exec === 'tee' ? body.teeConfig?.codeHash ?? null : null,
  ).run();

  return c.json({ ok: true, id: body.id });
});

// ── /api/skill/:id/run ────────────────────────────────────────
app.post('/api/skill/:id/run', async (c) => {
  const sess = await readSession(c);
  if (!sess) return c.json({ error: 'auth_required' }, 401);

  const skillId = c.req.param('id');
  const body = await c.req.json().catch(() => null) as {
    input?: string;
    model?: string;
    byokProvider?: string;
  } | null;
  if (!body?.input) return c.json({ error: 'input required' }, 400);

  const skill = await c.env.DB.prepare(
    `SELECT id, name, pricing_model, price_amount, execution_model, system_prompt,
            default_model, tee_provider, tee_endpoint, tee_code_hash, allowed_providers
     FROM skills WHERE id = ?`
  ).bind(skillId).first<SkillRow>();
  if (!skill) return c.json({ error: 'skill not found' }, 404);

  const ent = await checkEntitlement(c.env, sess.sub, skill.id, skill.pricing_model, skill.price_amount);
  if (!ent.ok) {
    return c.json({
      error: 'payment_required',
      reason: ent.reason,
      pricingModel: skill.pricing_model,
      priceAmount: skill.price_amount,
    }, 402);
  }

  const invocationId = crypto.randomUUID();
  const startedAt = Date.now();
  const tier = skill.execution_model === 'tee' ? 'tee'
             : skill.execution_model === 'managed' ? 'managed'
             : 'open';

  return sseStream(async (write) => {
    write('start', { invocationId, tier, skillId: skill.id });

    let inputTokens = 0, outputTokens = 0, fullOutput = '';
    const onDelta = (t: string) => { fullOutput += t; write('delta', t); };

    try {
      if (tier === 'tee') {
        const { result, attestation, attestationId } = await proxyToTEEWorker(c.env, skill, body.input, sess.sub);
        write('delta', result);
        fullOutput = result;
        write('attestation', { attestationId, codeHash: attestation.codeHash, provider: attestation.provider });
      } else if (tier === 'managed') {
        const provider = body.byokProvider || 'workers-ai';
        const sys = skill.system_prompt ?? `You are ${skill.name}.`;

        if (provider === 'workers-ai') {
          // Free path — uses Cloudflare's daily Workers AI allocation. No
          // third-party key required. Privacy still holds at platform layer
          // (prompt sealed in D1), but the "external provider anonymization"
          // is moot since the provider IS this platform's AI binding.
          const messages = [
            { role: 'system' as const, content: sys.slice(0, 4000) },
            { role: 'user' as const, content: body.input!.slice(0, 4000) },
          ];
          const aiStream = await c.env.AI.run(AI_MODEL, { messages, max_tokens: 768, stream: true } as any) as unknown as ReadableStream<Uint8Array>;
          const reader = aiStream.getReader();
          const dec = new TextDecoder();
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let sep;
            while ((sep = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, sep); buf = buf.slice(sep + 1);
              if (!line.startsWith('data: ')) continue;
              const json = line.slice(6).trim();
              if (!json || json === '[DONE]') continue;
              try {
                const e = JSON.parse(json);
                const t = e.response ?? e.choices?.[0]?.delta?.content;
                if (t) onDelta(t);
              } catch { /* skip */ }
            }
          }
        } else {
          const apiKey = await getBYOKKey(c.env, sess.sub, provider);
          if (!apiKey) {
            write('error', { message: `No BYOK key registered for provider '${provider}'. PUT /api/user/byok first.` });
            return;
          }
          const model = body.model || skill.default_model || (provider === 'anthropic' ? 'claude-haiku-4-5' : 'gpt-4o-mini');
          if (provider === 'anthropic') {
            const u = await callAnthropic({ apiKey, model, systemPrompt: sys, userInput: body.input!, onDelta });
            inputTokens = u.inputTokens; outputTokens = u.outputTokens;
          } else {
            const baseURL = providerBaseURLs(c.env)[provider];
            if (!baseURL) { write('error', { message: `Unknown provider ${provider}` }); return; }
            const u = await callOpenAICompatible({ apiKey, baseURL, model, systemPrompt: sys, userInput: body.input!, onDelta });
            inputTokens = u.inputTokens; outputTokens = u.outputTokens;
          }
        }
      } else {
        // Tier 0 — Workers AI on the platform account.
        const sys = skill.system_prompt ?? `You are ${skill.name}. ${''}`;
        const messages = [
          { role: 'system' as const, content: sys.slice(0, 4000) },
          { role: 'user' as const, content: body.input!.slice(0, 4000) },
        ];
        // env.AI.run with stream: true returns a ReadableStream of OpenAI-style SSE.
        const aiStream = await c.env.AI.run(AI_MODEL, { messages, max_tokens: 768, stream: true } as any) as unknown as ReadableStream<Uint8Array>;
        const reader = aiStream.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let sep;
          while ((sep = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, sep); buf = buf.slice(sep + 1);
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (!json || json === '[DONE]') continue;
            try {
              const e = JSON.parse(json);
              const t = e.response ?? e.choices?.[0]?.delta?.content;
              if (t) onDelta(t);
            } catch { /* skip */ }
          }
        }
      }

      const durationMs = Date.now() - startedAt;
      // Record invocation + consume per-call entitlement
      await c.env.DB.prepare(
        `INSERT INTO invocations (id, skill_id, caller_id, caller_type, provider, amount, tier, duration_ms, input_tokens, output_tokens)
         VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?, ?)`
      ).bind(
        invocationId, skill.id, sess.sub,
        // Tier-1 always records `byok` (the LLM call was paid for by the
        // caller's third-party key, regardless of whether the skill itself
        // is free). Tier 0/2 record the entitlement provider.
        tier === 'managed' ? 'byok' : (ent.reason === 'free' ? 'free' : 'stripe'),
        skill.price_amount, tier, durationMs, inputTokens, outputTokens,
      ).run().catch(e => console.error('invocations insert', e));

      if (ent.reason === 'per_call') {
        await consumePerCall(c.env, sess.sub, skill.id);
      }

      write('done', {
        invocationId, durationMs, tier,
        inputTokens, outputTokens,
        outputLength: fullOutput.length,
        entitlement: ent.reason,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      write('error', { message: msg, tier });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Agent access tickets
// ═══════════════════════════════════════════════════════════════
//
// The browser talks to the agent (`cc-sandbox`) over a *direct*
// WebSocket — no per-turn proxy hop, lowest latency. To stop the agent
// endpoint from being scanned/freeloaded, every connection must carry a
// short-lived HMAC ticket minted HERE, only after the user's session is
// validated. The agent worker verifies the signature + expiry before it
// boots any container or makes any LLM call.
//
//   POST /api/cc/ticket  →  { ticket, exp, agentUrl }   (needs session)
//
// The agent base URL is overridable per-environment; default matches the
// `cc-sandbox` deploy name on the account's workers.dev subdomain.
const DEFAULT_CC_SANDBOX_URL = 'https://cc-sandbox.candy-shop.workers.dev/';
const ccSandboxUrl = (c: any) =>
  (c.env.CC_SANDBOX_URL || DEFAULT_CC_SANDBOX_URL).replace(/\/+$/, '') + '/';

const TICKET_TTL_MS = 120_000; // enough to open the WS / pre-warm

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** ticket = b64url(payloadJSON) + "." + b64url(HMAC-SHA256(payloadB64)). */
async function mintTicket(
  secret: string,
  payload: { sub: string; exp: number; skill?: string },
): Promise<string> {
  const payloadB64 = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadB64),
  );
  return `${payloadB64}.${b64url(sig)}`;
}

// Mint an agent access ticket. Requires an authenticated session (guest
// sessions count — they still carry a stable `sub`), so an anonymous
// scanner with no session cookie cannot obtain one.
app.post('/api/cc/ticket', async (c) => {
  const sess = await readSession(c);
  if (!sess?.sub) {
    return c.json({ error: 'sign in (or start a guest session) first' }, 401);
  }
  const secret = c.env.CC_AGENT_TICKET_SECRET;
  if (!secret) {
    return c.json(
      { error: 'agent not configured (CC_AGENT_TICKET_SECRET unset)' },
      503,
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as { skill?: string };

  // Usage counter (observability / future rate-limit hook).
  const key = todayKey(`cc:${sess.sub}`);
  const used = parseInt((await c.env.AI_BUDGET.get(key)) ?? '0', 10);
  await c.env.AI_BUDGET.put(key, String(used + 1), {
    expirationTtl: secondsUntilUtcMidnight(),
  });

  const exp = Date.now() + TICKET_TTL_MS;
  const ticket = await mintTicket(secret, {
    sub: sess.sub,
    exp,
    skill: body.skill,
  });
  return c.json({ ticket, exp, agentUrl: ccSandboxUrl(c) });
});

// Daily usage counter (frontend shows this; no hard cap).
app.get('/api/cc/budget', async (c) => {
  const sess = await readSession(c);
  const key = todayKey(`cc:${sess?.sub ?? c.req.header('cf-connecting-ip') ?? 'anon'}`);
  const used = parseInt((await c.env.AI_BUDGET.get(key)) ?? '0', 10);
  return c.json({
    date: todayKey('').split(':')[1],
    used,
    limit: null,
    remaining: null,
    upstream: ccSandboxUrl(c),
    resets_in_seconds: secondsUntilUtcMidnight(),
  });
});

// Model catalog + per-model health, proxied to cc-sandbox (which holds the
// z.ai key). The ModelPicker reads /api/cc/models and /api/cc/health; the
// OpenCode runtime reuses these too (same GLM backend, provider stripped).
async function proxyCcGet(c: any, path: string): Promise<Response> {
  const search = new URL(c.req.url).search;
  const target = ccSandboxUrl(c).replace(/\/+$/, '') + path + search;
  try {
    const r = await fetch(target, { method: 'GET' });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { 'content-type': r.headers.get('content-type') || 'application/json' },
    });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'proxy failed' }, 502);
  }
}
app.get('/api/cc/models', (c) => proxyCcGet(c, '/models'));
app.get('/api/cc/health', (c) => proxyCcGet(c, '/health'));

// ═══════════════════════════════════════════════════════════════
// Fallback
// ═══════════════════════════════════════════════════════════════
app.all('*', (c) => c.json({ error: 'Not found', path: c.req.path }, 404));

export default app;
