// GET /api/x402/pricing/:skillId — x402 pricing metadata
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

function isX402Configured(): boolean {
  return !!process.env.X402_RECEIVER_ADDRESS;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = db();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { skillId } = req.query;

    const { data: skill } = await supabase
      .from('skills')
      .select('id, name, pricing_model, price_amount, price_currency')
      .eq('id', skillId as string)
      .single();

    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    res.json({
      skillId,
      pricingModel: skill.pricing_model,
      fiat: {
        amount: skill.price_amount,
        currency: skill.price_currency,
        display: `$${(skill.price_amount / 100).toFixed(2)}`,
      },
      x402: skill.pricing_model !== 'free' ? {
        network: process.env.X402_NETWORK || 'base-sepolia',
        token: 'USDC',
        amount: skill.price_amount * 10000,
        configured: isX402Configured(),
      } : null,
    });
  } catch (err) {
    console.error('x402 pricing error:', err);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
}
