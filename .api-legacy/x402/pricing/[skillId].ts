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
      .select('id, name, pricing_model, price_amount, price_currency, execution_model, tee_provider')
      .eq('id', skillId as string)
      .single();

    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    // Tier-2 TEE skills incur a confidential-execution surcharge on top of
    // the creator's listed price. This covers CVM hours + attestation recording.
    // Configurable via env so pricing can be tuned without a deploy.
    const teeSurchargeBps = Number(process.env.TEE_PRICE_SURCHARGE_BPS || 2000); // default +20%
    const teeSurchargeMinCents = Number(process.env.TEE_PRICE_SURCHARGE_MIN_CENTS || 1); // min 1¢
    const isTee = skill.execution_model === 'tee';
    const basePrice = skill.price_amount;
    const surcharge = isTee
      ? Math.max(teeSurchargeMinCents, Math.floor(basePrice * teeSurchargeBps / 10000))
      : 0;
    const effectivePrice = basePrice + surcharge;

    res.json({
      skillId,
      pricingModel: skill.pricing_model,
      fiat: {
        amount: effectivePrice,
        currency: skill.price_currency,
        display: `$${(effectivePrice / 100).toFixed(2)}`,
      },
      ...(isTee && {
        tee: {
          provider: skill.tee_provider,
          basePrice,
          surcharge,
          surchargeBps: teeSurchargeBps,
          note: 'Confidential execution surcharge — covers TEE compute + attestation',
        },
      }),
      x402: skill.pricing_model !== 'free' ? {
        network: process.env.X402_NETWORK || 'base-sepolia',
        token: 'USDC',
        amount: effectivePrice * 10000,
        configured: isX402Configured(),
      } : null,
    });
  } catch (err) {
    console.error('x402 pricing error:', err);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
}
