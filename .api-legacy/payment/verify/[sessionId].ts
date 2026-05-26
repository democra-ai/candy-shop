// GET /api/payment/verify/:sessionId — Verify Stripe checkout
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;
function stripe(): Stripe | null {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!stripe()) return res.status(503).json({ error: 'Stripe is not configured' });

    const { sessionId } = req.query;
    const session = await stripe()!.checkout.sessions.retrieve(sessionId as string);

    res.json({
      paid: session.payment_status === 'paid',
      status: session.status,
      skillIds: session.metadata?.skillIds?.split(',') || [],
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Failed to verify session' });
  }
}
