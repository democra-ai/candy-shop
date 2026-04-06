// GET /api/payment/purchases/:userId — Purchase history
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../_lib/cors';
import { supabaseAdmin } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId } = req.query;
    const { data, error } = await supabaseAdmin
      .from('purchases')
      .select('*, skills(name, icon, category)')
      .eq('user_id', userId as string)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to fetch purchases' });
    res.json({ purchases: data || [] });
  } catch (err) {
    console.error('Purchases error:', err);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
}
