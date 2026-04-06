// POST /api/invoke/:skillId — Invoke a skill (execution rights gateway)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../_lib/cors';
import { supabaseAdmin } from '../../_lib/supabase';
import { isStripeConfigured } from '../../_lib/stripe-provider';
import { isX402Configured, generatePaymentRequirement } from '../../_lib/x402-provider';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { skillId } = req.query;
    const { callerId, callerType = 'user', input = {} } = req.body;

    if (!callerId) return res.status(400).json({ error: 'callerId is required' });

    const { data: skill } = await supabaseAdmin
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
    const { data: hasEntitlement } = await supabaseAdmin
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
      const { data: consumed } = await supabaseAdmin
        .rpc('consume_call', { p_user_id: callerId, p_skill_id: skillId as string });
      if (!consumed) return res.status(402).json({ status: 'payment_required', message: 'No remaining calls.', skillId });
    }

    const invocationId = await recordInvocation(skillId as string, callerId, callerType, 'stripe', skill.price_amount);

    const { data: entitlement } = await supabaseAdmin
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

async function recordInvocation(skillId: string, callerId: string, callerType: string, provider: string, amount: number): Promise<string> {
  const { data } = await supabaseAdmin.rpc('record_invocation', {
    p_skill_id: skillId, p_caller_id: callerId, p_caller_type: callerType, p_provider: provider, p_amount: amount,
  });
  return data || 'inv-' + Date.now();
}
