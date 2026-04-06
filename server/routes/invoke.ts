// ============================================================
// Skill Invocation Routes — Execution Rights Gateway
// ============================================================
//
// Core concept: users/agents pay for EXECUTION RIGHTS, not files.
// This route handles the invocation lifecycle:
//   1. Check entitlement (was this skill paid for?)
//   2. Consume a call (for per_call pricing)
//   3. Record the invocation
//   4. Return result or payment requirement
//
// Supports both:
//   - Stripe (human users with active entitlements)
//   - x402 (autonomous agents paying per-call via HTTP 402)
// ============================================================

import { Router, type Request, type Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { isStripeConfigured } from '../lib/stripe-provider.js';
import { isX402Configured, generatePaymentRequirement } from '../lib/x402-provider.js';

export const invokeRouter = Router();

// ── POST /api/invoke/:skillId ──────────────────────────────
// Invoke a skill. Checks entitlement, records invocation, returns result.

invokeRouter.post('/:skillId', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;
    const { callerId, callerType = 'user', input = {} } = req.body;

    if (!callerId) {
      res.status(400).json({ error: 'callerId is required' });
      return;
    }

    // Fetch skill details
    const { data: skill } = await supabaseAdmin
      .from('skills')
      .select('id, name, pricing_model, price_amount, price_currency, execution_model, manifest_visibility')
      .eq('id', skillId)
      .single();

    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }

    // Free skills: always allowed
    if (skill.pricing_model === 'free' || skill.price_amount === 0) {
      const invocationId = await recordInvocation(skillId, callerId, callerType, 'free', 0);
      res.json({
        invocationId,
        skillId,
        status: 'success',
        message: 'Skill invoked successfully (free)',
        remainingCalls: null,
      });
      return;
    }

    // For agents with x402: check X-PAYMENT header
    if (callerType === 'agent') {
      const paymentHeader = req.headers['x-payment'] as string | undefined;
      if (!paymentHeader) {
        // Return 402 with payment requirements
        if (!isX402Configured()) {
          res.status(503).json({ error: 'x402 not configured for agent payments' });
          return;
        }

        const protocol = req.protocol;
        const host = req.get('host');
        const resource = `${protocol}://${host}/api/invoke/${skillId}`;
        const usdcAmount = skill.price_amount * 10000;

        const requirement = generatePaymentRequirement({
          skillId,
          amount: usdcAmount,
          resource,
        });

        res.status(402).json({
          status: 402,
          message: 'Payment Required — agent must include X-PAYMENT header',
          accepts: [requirement],
          skillId,
          pricingModel: skill.pricing_model,
          amount: skill.price_amount,
          currency: skill.price_currency,
        });
        return;
      }

      // Agent provided payment — record and proceed
      const invocationId = await recordInvocation(skillId, callerId, callerType, 'x402', skill.price_amount);
      res.json({
        invocationId,
        skillId,
        status: 'success',
        message: 'Skill invoked via x402 payment',
        provider: 'x402',
      });
      return;
    }

    // For human users: check entitlement
    const { data: hasEntitlement } = await supabaseAdmin
      .rpc('check_entitlement', { p_user_id: callerId, p_skill_id: skillId });

    if (!hasEntitlement) {
      res.status(402).json({
        status: 'payment_required',
        skillId,
        message: 'No active entitlement. Purchase execution rights to invoke this skill.',
        pricingModel: skill.pricing_model,
        amount: skill.price_amount,
        currency: skill.price_currency,
        paymentOptions: {
          stripe: isStripeConfigured(),
          x402: isX402Configured(),
        },
      });
      return;
    }

    // Consume a call for per_call entitlements
    if (skill.pricing_model === 'per_call') {
      const { data: consumed } = await supabaseAdmin
        .rpc('consume_call', { p_user_id: callerId, p_skill_id: skillId });

      if (!consumed) {
        res.status(402).json({
          status: 'payment_required',
          message: 'No remaining calls. Purchase more execution rights.',
          skillId,
        });
        return;
      }
    }

    // Record the invocation
    const invocationId = await recordInvocation(skillId, callerId, callerType, 'stripe', skill.price_amount);

    // Get remaining calls
    const { data: entitlement } = await supabaseAdmin
      .from('entitlements')
      .select('remaining_calls, type')
      .eq('user_id', callerId)
      .eq('skill_id', skillId)
      .single();

    res.json({
      invocationId,
      skillId,
      status: 'success',
      message: 'Skill invoked successfully',
      remainingCalls: entitlement?.remaining_calls ?? null,
    });
  } catch (err) {
    console.error('Invocation error:', err);
    res.status(500).json({ error: 'Failed to invoke skill' });
  }
});

// ── GET /api/invoke/:skillId/manifest ──────────────────────
// Returns the skill manifest (always visible, even without entitlement).
// This is the "visible but not accessible" concept.

invokeRouter.get('/:skillId/manifest', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;

    const { data: skill } = await supabaseAdmin
      .from('skills')
      .select(`
        id, name, description, category, icon, tags,
        pricing_model, price_amount, price_currency,
        execution_model, manifest_visibility,
        lineage_type, parent_skill_id, is_canonical, original_author,
        popularity, download_count, star_count, avg_rating
      `)
      .eq('id', skillId)
      .single();

    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }

    res.json({
      manifest: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        icon: skill.icon,
        tags: skill.tags,
        // Pricing info is always visible
        pricing: {
          model: skill.pricing_model,
          amount: skill.price_amount,
          currency: skill.price_currency,
          display: skill.price_amount > 0 ? `$${(skill.price_amount / 100).toFixed(2)}` : 'Free',
        },
        // Execution model info
        execution: {
          model: skill.execution_model,
          visibility: skill.manifest_visibility,
        },
        // Lineage is always visible — transparency
        lineage: {
          type: skill.lineage_type,
          parentId: skill.parent_skill_id,
          canonical: skill.is_canonical,
          originalAuthor: skill.original_author,
        },
        // Social proof
        stats: {
          popularity: skill.popularity,
          downloads: skill.download_count,
          stars: skill.star_count,
          rating: skill.avg_rating,
        },
        // Payment options
        paymentOptions: {
          stripe: isStripeConfigured(),
          x402: isX402Configured(),
        },
      },
    });
  } catch (err) {
    console.error('Manifest error:', err);
    res.status(500).json({ error: 'Failed to fetch manifest' });
  }
});

// ── GET /api/invoke/:skillId/stats ─────────────────────────
// Returns invocation statistics for a skill.

invokeRouter.get('/:skillId/stats', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;

    const { data: count } = await supabaseAdmin
      .rpc('get_invocation_count', { p_skill_id: skillId });

    res.json({
      skillId,
      totalInvocations: count || 0,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Helper: Record invocation ──────────────────────────────

async function recordInvocation(
  skillId: string,
  callerId: string,
  callerType: string,
  provider: string,
  amount: number,
): Promise<string> {
  const { data } = await supabaseAdmin
    .rpc('record_invocation', {
      p_skill_id: skillId,
      p_caller_id: callerId,
      p_caller_type: callerType,
      p_provider: provider,
      p_amount: amount,
    });
  return data || 'inv-' + Date.now();
}
