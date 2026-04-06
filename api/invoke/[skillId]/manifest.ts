// GET /api/invoke/:skillId/manifest — Public skill manifest (always visible)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../_lib/cors';
import { supabaseAdmin } from '../../_lib/supabase';
import { isStripeConfigured } from '../../_lib/stripe-provider';
import { isX402Configured } from '../../_lib/x402-provider';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { skillId } = req.query;

    const { data: skill } = await supabaseAdmin
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
