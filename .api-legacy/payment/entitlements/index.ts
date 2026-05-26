// GET /api/payment/entitlements?userId=xxx — List user entitlements (query-param variant)
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = req.query.userId as string | undefined;
  if (!userId) {
    return res.status(400).json({
      error: 'userId is required',
      usage: 'GET /api/payment/entitlements?userId=xxx  or  GET /api/payment/entitlements/{userId}',
    });
  }

  try {
    const client = db();
    if (!client) return res.json({ entitlements: [], note: 'Supabase not configured' });

    const { data, error } = await client
      .from('entitlements')
      .select('*')
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: 'Failed to fetch entitlements' });
    return res.json({ entitlements: data || [] });
  } catch (err: any) {
    console.error('Entitlements error:', err);
    return res.status(500).json({ error: 'Failed to fetch entitlements', detail: err.message });
  }
}
