// ============================================================
// Candy Shop — Backend on Cloudflare Workers (Hono + D1)
// ============================================================
// Routes ported from Express (server/routes/) and Vercel functions (api/).
// Only the Stripe payment surface is in scope for this Worker.
// Auth, realtime, and non-payment endpoints stay on Supabase for now.
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Stripe from 'stripe';

type Bindings = {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PUBLIC_APP_ORIGIN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// ── CORS — allow the frontend (Pages + dev) to hit us ──────
app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'stripe-signature', 'X-Payment'],
  credentials: false,
}));

const stripeFor = (env: Bindings) =>
  env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

// ── GET /api/health ────────────────────────────────────────
app.get('/api/health', (c) => c.json({
  status: 'ok',
  runtime: 'cloudflare-worker',
  providers: {
    stripe: !!c.env.STRIPE_SECRET_KEY,
    x402: false,
  },
  db: 'd1',
  timestamp: new Date().toISOString(),
}));

// ── POST /api/payment/checkout ─────────────────────────────
app.post('/api/payment/checkout', async (c) => {
  const stripe = stripeFor(c.env);
  if (!stripe) return c.json({ error: 'Stripe is not configured on this server' }, 503);

  const body = await c.req.json().catch(() => null) as {
    skillIds?: string[];
    userId?: string;
    successUrl?: string;
    cancelUrl?: string;
  } | null;
  if (!body?.skillIds?.length || !body.userId) {
    return c.json({ error: 'skillIds and userId are required' }, 400);
  }

  // Fetch requested skills' pricing from D1
  const placeholders = body.skillIds.map(() => '?').join(',');
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, description, icon, pricing_model, price_amount, price_currency
     FROM skills
     WHERE id IN (${placeholders})`
  ).bind(...body.skillIds).all<{
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    pricing_model: string;
    price_amount: number;
    price_currency: string;
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

  if (items.length === 0) {
    return c.json({ free: true, skillIds: body.skillIds });
  }

  const origin = c.env.PUBLIC_APP_ORIGIN
    || c.req.header('origin')
    || new URL(c.req.url).origin;

  const baseSuccess = body.successUrl || `${origin}/skills/library?payment=success`;
  const sep = baseSuccess.includes('?') ? '&' : '?';
  const successUrl = `${baseSuccess}${sep}session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = body.cancelUrl || `${origin}/?payment=cancelled`;

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
    success_url: successUrl,
    cancel_url: cancelUrl,
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
    sessionRowId,
    body.userId,
    JSON.stringify(items.map(i => i.skillId)),
    total,
    items[0]?.currency || 'usd',
    session.id,
  ).run().catch(err => console.error('D1 insert checkout_sessions failed:', err));

  return c.json({
    provider: 'stripe',
    sessionId: session.id,
    checkoutUrl: session.url,
  });
});

// ── GET /api/payment/verify/:sessionId ─────────────────────
app.get('/api/payment/verify/:sessionId', async (c) => {
  const stripe = stripeFor(c.env);
  if (!stripe) return c.json({ error: 'Stripe is not configured' }, 503);

  const sessionId = c.req.param('sessionId');
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  return c.json({
    paid: session.payment_status === 'paid',
    status: session.status,
    skillIds: session.metadata?.skillIds?.split(',') || [],
  });
});

// ── GET /api/payment/entitlements/:userId ──────────────────
app.get('/api/payment/entitlements/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { results } = await c.env.DB.prepare(
    `SELECT user_id, skill_id, type, granted_at, expires_at, remaining_calls, provider, purchase_id
     FROM entitlements WHERE user_id = ?`
  ).bind(userId).all();
  return c.json({ entitlements: results || [] });
});

// ── GET /api/payment/purchases/:userId ─────────────────────
app.get('/api/payment/purchases/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, s.name AS skill_name, s.icon AS skill_icon, s.category AS skill_category
     FROM purchases p LEFT JOIN skills s ON s.id = p.skill_id
     WHERE p.user_id = ? ORDER BY p.created_at DESC`
  ).bind(userId).all();
  return c.json({ purchases: results || [] });
});

// ── GET /api/payment/check/:userId/:skillId ────────────────
app.get('/api/payment/check/:userId/:skillId', async (c) => {
  const { userId, skillId } = c.req.param();
  const skill = await c.env.DB.prepare(
    `SELECT pricing_model, price_amount FROM skills WHERE id = ? LIMIT 1`
  ).bind(skillId).first<{ pricing_model: string; price_amount: number }>();

  if (!skill || skill.pricing_model === 'free' || skill.price_amount === 0) {
    return c.json({ hasAccess: true, reason: 'free' });
  }

  // Inline the Postgres check_entitlement() RPC:
  // user has access if there's an entitlement that is either permanent,
  // or a non-expired subscription, or has remaining_calls > 0.
  const ent = await c.env.DB.prepare(
    `SELECT type, expires_at, remaining_calls FROM entitlements
     WHERE user_id = ? AND skill_id = ? LIMIT 1`
  ).bind(userId, skillId).first<{
    type: string; expires_at: string | null; remaining_calls: number | null;
  }>();

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

// ── POST /api/webhook/stripe ───────────────────────────────
// Stripe → us. Must verify the signature before trusting the payload.
app.post('/api/webhook/stripe', async (c) => {
  const stripe = stripeFor(c.env);
  if (!stripe) return c.json({ error: 'Stripe not configured' }, 503);
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Webhook secret not configured' }, 503);
  }

  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'Missing stripe-signature header' }, 400);

  const rawBody = await c.req.text();
  let event: Stripe.Event;
  try {
    // Workers runtime: use constructEventAsync (SubtleCrypto-based, non-blocking)
    event = await stripe.webhooks.constructEventAsync(
      rawBody, sig, c.env.STRIPE_WEBHOOK_SECRET
    );
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
    ? session.payment_intent
    : session.payment_intent?.id;

  if (!userId || skillIds.length === 0) {
    return c.json({ processed: false, reason: 'missing metadata' });
  }

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
    ).bind(
      purchaseId, userId, skillId, amount, currency,
      paymentIntentId ?? null,
      JSON.stringify({ stripe_session_id: session.id }),
    ).run();

    const entType = skill?.pricing_model === 'per_call' ? 'per_call'
      : skill?.pricing_model === 'subscription' ? 'subscription'
      : 'permanent';
    const expiresAt = entType === 'subscription'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const remainingCalls = entType === 'per_call' ? 100 : null;

    await c.env.DB.prepare(
      `INSERT INTO entitlements
         (user_id, skill_id, type, expires_at, remaining_calls, provider, purchase_id)
       VALUES (?, ?, ?, ?, ?, 'stripe', ?)
       ON CONFLICT(user_id, skill_id) DO UPDATE SET
         type = excluded.type,
         expires_at = excluded.expires_at,
         remaining_calls = excluded.remaining_calls,
         provider = excluded.provider,
         purchase_id = excluded.purchase_id,
         granted_at = datetime('now')`
    ).bind(userId, skillId, entType, expiresAt, remainingCalls, purchaseId).run();
  }

  await c.env.DB.prepare(
    `UPDATE checkout_sessions SET status = 'completed' WHERE stripe_session_id = ?`
  ).bind(session.id).run();

  return c.json({ processed: true, skillIds, userId });
});

// ── Fallback 404 ───────────────────────────────────────────
app.all('*', (c) => c.json({ error: 'Not found', path: c.req.path }, 404));

export default app;
