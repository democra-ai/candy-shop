// ============================================================
// x402 Protocol Routes — Agent-Native Payment Endpoints
// ============================================================
//
// These endpoints implement the server side of the x402 protocol:
//   - GET  /api/x402/skill/:skillId  → Returns 402 with payment requirements
//   - POST /api/x402/skill/:skillId  → Agent pays & accesses the skill
//
// The x402 flow for an autonomous agent:
//   1. Agent GETs the skill endpoint
//   2. Receives 402 + JSON payment requirements
//   3. Signs the payment with its wallet
//   4. POSTs back with X-PAYMENT header
//   5. Server verifies & grants access
// ============================================================

import { Router, type Request, type Response } from 'express';
import {
  isX402Configured,
  generatePaymentRequirement,
  parseX402Header,
  verifyX402Payment,
  recordX402Payment,
} from '../lib/x402-provider.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const x402Router = Router();

// Store pending payment requirements in memory (production: use Redis/DB)
const pendingRequirements = new Map<string, {
  requirement: ReturnType<typeof generatePaymentRequirement>;
  skillId: string;
  createdAt: number;
}>();

// Clean up expired requirements every 5 minutes
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [key, value] of pendingRequirements) {
    if (value.requirement.expiry < now) {
      pendingRequirements.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ── GET /api/x402/skill/:skillId ────────────────────────────
// Returns 402 Payment Required with x402-compatible payment details.

x402Router.get('/skill/:skillId', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;

    // Check if agent already has access via X-PAYMENT header
    const paymentHeader = req.headers['x-payment'] as string | undefined;
    if (paymentHeader) {
      // Redirect to POST handler logic
      return handleAgentPayment(req, res, skillId, paymentHeader);
    }

    // Fetch skill pricing
    const { data: skill } = await supabaseAdmin
      .from('skills')
      .select('id, name, pricing_model, price_amount, x402_resource_url')
      .eq('id', skillId)
      .single();

    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }

    if (skill.pricing_model === 'free' || skill.price_amount === 0) {
      res.json({
        access: 'granted',
        skillId,
        message: 'This skill is free to use',
      });
      return;
    }

    if (!isX402Configured()) {
      res.status(503).json({ error: 'x402 payment receiver not configured' });
      return;
    }

    // Generate 402 payment requirement
    const protocol = req.protocol;
    const host = req.get('host');
    const resource = skill.x402_resource_url || `${protocol}://${host}/api/x402/skill/${skillId}`;

    // Convert price: DB stores cents, x402 USDC uses 6 decimals
    // e.g., $1.00 = 100 cents = 1000000 USDC base units
    const usdcAmount = skill.price_amount * 10000;

    const requirement = generatePaymentRequirement({
      skillId,
      amount: usdcAmount,
      resource,
    });

    // Cache the requirement for verification
    pendingRequirements.set(requirement.nonce, {
      requirement,
      skillId,
      createdAt: Date.now(),
    });

    // Return 402 Payment Required
    res.status(402).json({
      status: 402,
      message: 'Payment Required',
      accepts: [requirement],
      // x402-standard headers
      'x-payment-required': true,
    });
  } catch (err) {
    console.error('x402 GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/x402/skill/:skillId ───────────────────────────
// Agent submits payment. Verify and grant access.

x402Router.post('/skill/:skillId', async (req: Request, res: Response) => {
  const { skillId } = req.params;
  const paymentHeader = req.headers['x-payment'] as string | undefined;

  if (!paymentHeader) {
    res.status(400).json({ error: 'Missing X-PAYMENT header' });
    return;
  }

  return handleAgentPayment(req, res, skillId, paymentHeader);
});

// ── Shared: verify agent payment ────────────────────────────

async function handleAgentPayment(
  req: Request,
  res: Response,
  skillId: string,
  paymentHeader: string,
) {
  try {
    const payload = parseX402Header(paymentHeader);
    if (!payload) {
      res.status(400).json({ error: 'Invalid X-PAYMENT header format (expected base64 JSON)' });
      return;
    }

    // Find the pending requirement by nonce
    const pending = pendingRequirements.get(payload.paymentDetails.nonce);
    if (!pending) {
      res.status(400).json({ error: 'Unknown or expired payment nonce' });
      return;
    }

    if (pending.skillId !== skillId) {
      res.status(400).json({ error: 'Skill ID mismatch' });
      return;
    }

    // Verify the payment
    const verification = await verifyX402Payment(payload, pending.requirement);
    if (!verification.valid) {
      res.status(402).json({
        error: 'Payment verification failed',
        reason: verification.error,
      });
      return;
    }

    // Record the payment
    // In a real system, the userId would come from the agent's auth context
    const userId = req.body?.userId || payload.payer;
    await recordX402Payment({
      userId,
      skillId,
      payer: payload.payer,
      amount: verification.amount || 0,
      nonce: payload.paymentDetails.nonce,
    });

    // Clean up the used nonce
    pendingRequirements.delete(payload.paymentDetails.nonce);

    // Grant access
    res.json({
      access: 'granted',
      skillId,
      provider: 'x402',
      payer: payload.payer,
      message: 'Payment verified. Skill access granted.',
    });
  } catch (err) {
    console.error('x402 payment error:', err);
    res.status(500).json({ error: 'Payment processing failed' });
  }
}

// ── GET /api/x402/pricing/:skillId ──────────────────────────
// Returns x402 pricing info (no 402 response, just metadata).

x402Router.get('/pricing/:skillId', async (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;

    const { data: skill } = await supabaseAdmin
      .from('skills')
      .select('id, name, pricing_model, price_amount, price_currency')
      .eq('id', skillId)
      .single();

    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }

    res.json({
      skillId,
      pricingModel: skill.pricing_model,
      fiat: {
        amount: skill.price_amount,
        currency: skill.price_currency,
        display: `$${(skill.price_amount / 100).toFixed(2)}`,
      },
      x402: skill.pricing_model !== 'free' ? {
        network: process.env.X402_NETWORK || 'base-sepolia',
        token: 'USDC',
        amount: skill.price_amount * 10000, // cents to USDC base units
        configured: isX402Configured(),
      } : null,
    });
  } catch (err) {
    console.error('x402 pricing error:', err);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});
