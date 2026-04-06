// GET /api/health — Server health check + payment config
// Also serves as /api/payment/config via Vercel rewrite (see vercel.json)
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
  const x402Configured = !!process.env.X402_RECEIVER_ADDRESS;
  const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  // If accessed via /api/payment/config rewrite, return payment-focused response
  if (req.url?.startsWith('/api/payment/config')) {
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

  return res.json({
    status: 'ok',
    providers: { stripe: stripeConfigured, x402: x402Configured },
    supabase: supabaseConfigured,
    timestamp: new Date().toISOString(),
  });
}
