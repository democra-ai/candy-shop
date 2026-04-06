// ============================================================
// Stripe Webhook Handler
// ============================================================

import { Router, type Request, type Response } from 'express';
import express from 'express';
import { handleStripeWebhook, isStripeConfigured } from '../lib/stripe-provider.js';

export const webhookRouter = Router();

// Raw body parser for Stripe signature verification
webhookRouter.use(express.raw({ type: 'application/json' }));

webhookRouter.post('/stripe', async (req: Request, res: Response) => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  try {
    const result = await handleStripeWebhook(req.body as Buffer, signature);
    console.log('Webhook processed:', result);
    res.json({ received: true, ...result });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
});
