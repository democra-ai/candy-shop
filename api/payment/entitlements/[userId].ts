// GET /api/payment/entitlements/:userId — List user entitlements
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../_lib/cors';
import { supabaseAdmin } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId } = req.query;
    const { data, error } = await supabaseAdmin
      .from('entitlements')
      .select('*')
      .eq('user_id', userId as string);

    if (error) return res.status(500).json({ error: 'Failed to fetch entitlements' });
    res.json({ entitlements: data || [] });
  } catch (err) {
    console.error('Entitlements error:', err);
    res.status(500).json({ error: 'Failed to fetch entitlements' });
  }
}
