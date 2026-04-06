// POST /api/invoke/:skillId — Invoke a skill (execution rights gateway)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// --- Inline Supabase client ---
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

// --- Inline config checks ---
function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

function isX402Configured(): boolean {
  return !!process.env.X402_RECEIVER_ADDRESS;
}

// --- Inline x402 payment requirement generator ---
const USDC_CONTRACTS: Record<string, string> = {
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

interface X402PaymentRequirement {
  resource: string;
  scheme: 'exact';
  network: string;
  paymentToken: string;
  maxAmountRequired: string;
  payTo: string;
  nonce: string;
  expiry: number;
}

function generatePaymentRequirement(params: { skillId: string; amount: number; resource: string }): X402PaymentRequirement {
  const network = (process.env.X402_NETWORK || 'base-sepolia') as string;
  const receiverAddress = process.env.X402_RECEIVER_ADDRESS || '';
  return {
    resource: params.resource,
    scheme: 'exact',
    network,
    paymentToken: USDC_CONTRACTS[network] || USDC_CONTRACTS['base-sepolia'],
    maxAmountRequired: params.amount.toString(),
    payTo: receiverAddress,
    nonce: crypto.randomUUID(),
    expiry: Math.floor(Date.now() / 1000) + 300,
  };
}

// --- Record invocation helper ---
async function recordInvocation(skillId: string, callerId: string, callerType: string, provider: string, amount: number): Promise<string> {
  const supabase = db();
  if (!supabase) return 'inv-' + Date.now();
  const { data } = await supabase.rpc('record_invocation', {
    p_skill_id: skillId, p_caller_id: callerId, p_caller_type: callerType, p_provider: provider, p_amount: amount,
  });
  return data || 'inv-' + Date.now();
}

// --- Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = db();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { skillId } = req.query;
    const { callerId, callerType = 'user', input = {} } = req.body;

    if (!callerId) return res.status(400).json({ error: 'callerId is required' });

    const { data: skill } = await supabase
      .from('skills')
      .select('id, name, pricing_model, price_amount, price_currency, execution_model, manifest_visibility')
      .eq('id', skillId as string)
      .single();

    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    // Free skills: always allowed
    if (skill.pricing_model === 'free' || skill.price_amount === 0) {
      const invocationId = await recordInvocation(skillId as string, callerId, callerType, 'free', 0);
      return res.json({
        invocationId, skillId, status: 'success',
        message: 'Skill invoked successfully (free)', remainingCalls: null,
      });
    }

    // Agent with x402
    if (callerType === 'agent') {
      const paymentHeader = req.headers['x-payment'] as string | undefined;
      if (!paymentHeader) {
        if (!isX402Configured()) return res.status(503).json({ error: 'x402 not configured for agent payments' });

        const host = req.headers.host || 'candy-shop.democra.ai';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const resource = `${protocol}://${host}/api/invoke/${skillId}`;
        const requirement = generatePaymentRequirement({ skillId: skillId as string, amount: skill.price_amount * 10000, resource });

        return res.status(402).json({
          status: 402,
          message: 'Payment Required — agent must include X-PAYMENT header',
          accepts: [requirement],
          skillId, pricingModel: skill.pricing_model, amount: skill.price_amount, currency: skill.price_currency,
        });
      }

      const invocationId = await recordInvocation(skillId as string, callerId, callerType, 'x402', skill.price_amount);
      return res.json({ invocationId, skillId, status: 'success', message: 'Skill invoked via x402 payment', provider: 'x402' });
    }

    // Human user: check entitlement
    const { data: hasEntitlement } = await supabase
      .rpc('check_entitlement', { p_user_id: callerId, p_skill_id: skillId as string });

    if (!hasEntitlement) {
      return res.status(402).json({
        status: 'payment_required', skillId,
        message: 'No active entitlement. Purchase execution rights to invoke this skill.',
        pricingModel: skill.pricing_model, amount: skill.price_amount, currency: skill.price_currency,
        paymentOptions: { stripe: isStripeConfigured(), x402: isX402Configured() },
      });
    }

    if (skill.pricing_model === 'per_call') {
      const { data: consumed } = await supabase
        .rpc('consume_call', { p_user_id: callerId, p_skill_id: skillId as string });
      if (!consumed) return res.status(402).json({ status: 'payment_required', message: 'No remaining calls.', skillId });
    }

    const invocationId = await recordInvocation(skillId as string, callerId, callerType, 'stripe', skill.price_amount);

    const { data: entitlement } = await supabase
      .from('entitlements')
      .select('remaining_calls, type')
      .eq('user_id', callerId)
      .eq('skill_id', skillId as string)
      .single();

    res.json({ invocationId, skillId, status: 'success', message: 'Skill invoked successfully', remainingCalls: entitlement?.remaining_calls ?? null });
  } catch (err) {
    console.error('Invocation error:', err);
    res.status(500).json({ error: 'Failed to invoke skill' });
  }
}
