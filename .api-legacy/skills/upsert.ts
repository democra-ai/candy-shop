// POST /api/skills/upsert — Publish/update a skill to the marketplace
// Accepts the creator-side Skill shape and writes the marketplace-visible
// subset (including TEE tier config) to public.skills.
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

interface IncomingSkill {
  id: string;
  userId?: string;
  name: string;
  description: string;
  category?: string;
  icon?: string;
  tags?: string[];
  isPublic?: boolean;
  executionModel?: 'open' | 'managed' | 'tee';
  teeConfig?: {
    provider?: string;
    endpoint?: string;
    codeHash?: string;
    attestationUrl?: string;
  };
  pricingModel?: string;
  price?: number;                     // cents
}

const VALID_EXEC = new Set(['open', 'managed', 'tee', 'federated']);
const VALID_PROVIDER = new Set(['phala', 'aws-nitro', 'gcp-cs', 'azure-cc', 'oasis']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = db();
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });

  try {
    const skill = req.body as IncomingSkill;
    if (!skill?.id || !skill.name) return res.status(400).json({ error: 'id and name are required' });

    const execModel = skill.executionModel ?? 'open';
    if (!VALID_EXEC.has(execModel)) return res.status(400).json({ error: `Invalid executionModel: ${execModel}` });

    // TEE-specific validation
    if (execModel === 'tee') {
      const p = skill.teeConfig?.provider;
      if (!p || !VALID_PROVIDER.has(p)) {
        return res.status(400).json({ error: 'TEE skills require teeConfig.provider' });
      }
      if (skill.teeConfig?.endpoint && !/^https?:\/\//.test(skill.teeConfig.endpoint)) {
        return res.status(400).json({ error: 'tee_endpoint must be http(s) URL' });
      }
      if (skill.teeConfig?.codeHash && !/^[0-9a-f]{64}$/i.test(skill.teeConfig.codeHash)) {
        return res.status(400).json({ error: 'tee_code_hash must be sha256 hex' });
      }
    }

    const row = {
      id: skill.id,
      name: skill.name,
      description: skill.description || '',
      category: skill.category || 'Custom',
      icon: skill.icon || '✨',
      tags: skill.tags || [],
      pricing_model: skill.pricingModel || 'free',
      price_amount: typeof skill.price === 'number' ? skill.price : 0,
      price_currency: 'usd',
      execution_model: execModel,
      manifest_visibility: execModel === 'open' ? 'full' : 'manifest_only',
      tee_provider: execModel === 'tee' ? skill.teeConfig?.provider ?? null : null,
      tee_endpoint: execModel === 'tee' ? skill.teeConfig?.endpoint ?? null : null,
      tee_code_hash: execModel === 'tee' ? skill.teeConfig?.codeHash ?? null : null,
      tee_attestation_url: execModel === 'tee' ? skill.teeConfig?.attestationUrl ?? null : null,
    };

    const { data, error } = await supabase.from('skills').upsert(row, { onConflict: 'id' }).select('id').single();
    if (error) {
      console.error('Skill upsert error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ ok: true, id: (data as { id: string } | null)?.id ?? skill.id });
  } catch (err) {
    console.error('Upsert handler error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upsert failed' });
  }
}
