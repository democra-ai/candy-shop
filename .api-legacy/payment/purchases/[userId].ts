// GET /api/payment/purchases/:userId — Purchase history
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = db();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { userId } = req.query;
    const { data, error } = await supabase
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
