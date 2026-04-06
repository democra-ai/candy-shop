// GET /api/invoke/:skillId/stats — Invocation statistics
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../_lib/cors';
import { supabaseAdmin } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { skillId } = req.query;
    const { data: count } = await supabaseAdmin
      .rpc('get_invocation_count', { p_skill_id: skillId as string });

    res.json({ skillId, totalInvocations: count || 0 });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}
