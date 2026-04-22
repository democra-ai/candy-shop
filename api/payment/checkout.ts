// POST /api/payment/checkout — Create Stripe checkout session
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

let _stripe: Stripe | null = null;
function stripe(): Stripe | null {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

let _db: ReturnType<typeof createClient> | null = null;
function db() {
  if (!_db) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) return null;
    _db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return _db;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!stripe()) {
      return res.status(503).json({ error: 'Stripe is not configured on this server' });
    }

    const supabase = db();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { skillIds, userId, successUrl, cancelUrl } = req.body;
    if (!skillIds?.length || !userId) {
      return res.status(400).json({ error: 'skillIds and userId are required' });
    }

    const { data: skills, error } = await supabase
      .from('skills')
      .select('id, name, description, price_amount, price_currency, pricing_model, icon')
      .in('id', skillIds);

    if (error || !skills?.length) {
      return res.status(404).json({ error: 'Skills not found' });
    }

    const items = skills
      .filter((s: any) => s.pricing_model !== 'free' && s.price_amount > 0)
      .map((s: any) => ({
        skillId: s.id,
        name: s.name,
        description: s.description || `AI Skill: ${s.name}`,
        amount: s.price_amount,
        currency: s.price_currency || 'usd',
      }));

    if (items.length === 0) {
      return res.json({ free: true, skillIds });
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => ({
      price_data: {
        currency: item.currency,
        product_data: {
          name: item.name,
          description: item.description,
        },
        unit_amount: item.amount,
      },
      quantity: 1,
    }));

    const origin = req.headers.origin || 'https://candy-shop.democra.ai';

    // Compose success URL preserving any existing query params
    // (Stripe substitutes {CHECKOUT_SESSION_ID}; we must use & if ? already present)
    const baseSuccessUrl = successUrl || `${origin}/skills/library?payment=success`;
    const successSep = baseSuccessUrl.includes('?') ? '&' : '?';
    const finalSuccessUrl = `${baseSuccessUrl}${successSep}session_id={CHECKOUT_SESSION_ID}`;

    const session = await stripe()!.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: finalSuccessUrl,
      cancel_url: cancelUrl || `${origin}/?payment=cancelled`,
      metadata: {
        userId,
        skillIds: items.map((i: any) => i.skillId).join(','),
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    const totalAmount = items.reduce((sum: number, i: any) => sum + i.amount, 0);
    await supabase.from('checkout_sessions').insert({
      user_id: userId,
      provider: 'stripe',
      status: 'open',
      skill_ids: items.map((i: any) => i.skillId),
      total_amount: totalAmount,
      currency: items[0]?.currency || 'usd',
      stripe_session_id: session.id,
    });

    res.json({ provider: 'stripe', sessionId: session.id, checkoutUrl: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
