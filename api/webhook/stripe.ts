// POST /api/webhook/stripe — Stripe webhook handler
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// --- Inline Stripe client ---
let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// --- Inline Supabase client ---
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

// Disable body parsing — Stripe needs raw body for signature verification
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!webhookSecret) return res.status(503).json({ error: 'Stripe webhook secret not configured' });

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  try {
    // Read raw body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const supabase = db();
      if (!supabase) return res.status(503).json({ error: 'Database not configured' });

      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const skillIds = session.metadata?.skillIds?.split(',') || [];
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

      if (!userId || skillIds.length === 0) {
        return res.json({ received: true, processed: false });
      }

      for (const skillId of skillIds) {
        const { data: skill } = await supabase
          .from('skills')
          .select('price_amount, price_currency, pricing_model')
          .eq('id', skillId)
          .single();

        const amount = skill?.price_amount || session.amount_total || 0;
        const currency = skill?.price_currency || session.currency || 'usd';

        const { data: purchase } = await supabase.from('purchases').insert({
          user_id: userId,
          skill_id: skillId,
          provider: 'stripe',
          status: 'completed',
          amount,
          currency,
          external_id: paymentIntentId,
          metadata: { stripe_session_id: session.id },
        }).select('id').single();

        const entitlementType = skill?.pricing_model === 'per_call' ? 'per_call'
          : skill?.pricing_model === 'subscription' ? 'subscription'
          : 'permanent';

        await supabase.from('entitlements').upsert({
          user_id: userId,
          skill_id: skillId,
          type: entitlementType,
          remaining_calls: entitlementType === 'per_call' ? 100 : null,
          expires_at: entitlementType === 'subscription'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null,
          provider: 'stripe',
          purchase_id: purchase?.id,
        }, { onConflict: 'user_id,skill_id' });
      }

      await supabase.from('checkout_sessions')
        .update({ status: 'completed' })
        .eq('stripe_session_id', session.id);

      res.json({ received: true, processed: true, skillIds, userId });
    } else {
      res.json({ received: true, processed: false, eventType: event.type });
    }
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
}
