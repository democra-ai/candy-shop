// GET /api/health — Server health check
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from './_lib/cors';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  res.json({
    status: 'ok',
    providers: {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      x402: !!process.env.X402_RECEIVER_ADDRESS,
    },
    supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    timestamp: new Date().toISOString(),
  });
}
