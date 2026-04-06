// GET /api/invoke/:skillId/manifest — Public skill manifest (always visible)
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

function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
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
    const { skillId } = req.query;
    const supabase = db();

    // If database is not configured, return a degraded but useful response
    if (!supabase) {
      return res.json({
        manifest: {
          id: skillId,
          name: null,
          description: null,
          source: 'fallback',
          note: 'Database not configured — skill metadata unavailable. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
          paymentOptions: { stripe: isStripeConfigured(), x402: isX402Configured() },
        },
      });
    }

    const { data: skill } = await supabase
      .from('skills')
      .select(`
        id, name, description, category, icon, tags,
        pricing_model, price_amount, price_currency,
        execution_model, manifest_visibility,
        lineage_type, parent_skill_id, is_canonical, original_author,
        popularity, download_count, star_count, avg_rating
      `)
      .eq('id', skillId as string)
      .single();

    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    res.json({
      manifest: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        icon: skill.icon,
        tags: skill.tags,
        pricing: {
          model: skill.pricing_model,
          amount: skill.price_amount,
          currency: skill.price_currency,
          display: skill.price_amount > 0 ? `$${(skill.price_amount / 100).toFixed(2)}` : 'Free',
        },
        execution: { model: skill.execution_model, visibility: skill.manifest_visibility },
        lineage: {
          type: skill.lineage_type,
          parentId: skill.parent_skill_id,
          canonical: skill.is_canonical,
          originalAuthor: skill.original_author,
        },
        stats: {
          popularity: skill.popularity,
          downloads: skill.download_count,
          stars: skill.star_count,
          rating: skill.avg_rating,
        },
        paymentOptions: { stripe: isStripeConfigured(), x402: isX402Configured() },
      },
    });
  } catch (err) {
    console.error('Manifest error:', err);
    res.status(500).json({ error: 'Failed to fetch manifest' });
  }
}
