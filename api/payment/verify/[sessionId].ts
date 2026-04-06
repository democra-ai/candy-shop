// GET /api/payment/verify/:sessionId — Verify Stripe checkout
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../_lib/cors';
import { verifyStripeSession, isStripeConfigured } from '../../_lib/stripe-provider';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!isStripeConfigured()) return res.status(503).json({ error: 'Stripe is not configured' });

    const { sessionId } = req.query;
    const result = await verifyStripeSession(sessionId as string);
    res.json({ paid: result.paid, status: result.status, skillIds: result.skillIds });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Failed to verify session' });
  }
}
