// GET /api/x402/pricing/:skillId — x402 pricing metadata
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../_lib/cors';
import { supabaseAdmin } from '../../_lib/supabase';
import { isX402Configured } from '../../_lib/x402-provider';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { skillId } = req.query;

    const { data: skill } = await supabaseAdmin
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
