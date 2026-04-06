// POST /api/webhook/stripe — Stripe webhook handler
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleStripeWebhook, isStripeConfigured } from '../_lib/stripe-provider';

// Disable body parsing — Stripe needs raw body for signature verification
export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isStripeConfigured()) return res.status(503).json({ error: 'Stripe not configured' });

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

    const result = await handleStripeWebhook(rawBody, signature);
    res.json({ received: true, ...result });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
}
