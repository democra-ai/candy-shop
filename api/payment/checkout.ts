// POST /api/payment/checkout — Create Stripe checkout session
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../_lib/cors';
import { createStripeCheckout, isStripeConfigured } from '../_lib/stripe-provider';
import { supabaseAdmin } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured on this server' });
    }

    const { skillIds, userId, successUrl, cancelUrl } = req.body;
    if (!skillIds?.length || !userId) {
      return res.status(400).json({ error: 'skillIds and userId are required' });
    }

    const { data: skills, error } = await supabaseAdmin
      .from('skills')
      .select('id, name, description, price_amount, price_currency, pricing_model, icon')
      .in('id', skillIds);

    if (error || !skills?.length) {
      return res.status(404).json({ error: 'Skills not found' });
    }

    const items = skills
      .filter(s => s.pricing_model !== 'free' && s.price_amount > 0)
      .map(s => ({
        skillId: s.id,
        name: s.name,
        description: s.description || `AI Skill: ${s.name}`,
        amount: s.price_amount,
        currency: s.price_currency || 'usd',
      }));

    if (items.length === 0) {
      return res.json({ free: true, skillIds });
    }

    const origin = req.headers.origin || 'https://candy-shop.democra.ai';
    const result = await createStripeCheckout({
      userId,
      items,
      successUrl: successUrl || `${origin}/skills/library?payment=success`,
      cancelUrl: cancelUrl || `${origin}/?payment=cancelled`,
    });

    res.json({ provider: 'stripe', sessionId: result.sessionId, checkoutUrl: result.checkoutUrl });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
