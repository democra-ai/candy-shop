// GET /api/payment/config — Public payment configuration
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
  const x402Configured = !!process.env.X402_RECEIVER_ADDRESS;

  return res.json({
    providers: {
      stripe: {
        enabled: stripeConfigured,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
      },
      x402: {
        enabled: x402Configured,
        network: process.env.X402_NETWORK || 'base-sepolia',
      },
    },
    supportedCurrencies: ['usd'],
    pricingModels: ['free', 'one_time', 'subscription', 'per_call'],
  });
}
