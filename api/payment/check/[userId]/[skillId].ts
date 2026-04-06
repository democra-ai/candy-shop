// GET /api/payment/check/:userId/:skillId — Quick access check
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../../_lib/cors';
import { supabaseAdmin } from '../../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, skillId } = req.query;

    const { data: skill } = await supabaseAdmin
      .from('skills')
      .select('pricing_model, price_amount')
      .eq('id', skillId as string)
      .single();

    if (!skill || skill.pricing_model === 'free' || skill.price_amount === 0) {
      return res.json({ hasAccess: true, reason: 'free' });
    }

    const { data: result } = await supabaseAdmin
      .rpc('check_entitlement', { p_user_id: userId as string, p_skill_id: skillId as string });

    res.json({ hasAccess: !!result, reason: result ? 'purchased' : 'payment_required' });
  } catch (err) {
    console.error('Check error:', err);
    res.status(500).json({ error: 'Failed to check access' });
  }
}
