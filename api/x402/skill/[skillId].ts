// GET+POST /api/x402/skill/:skillId — x402 protocol endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../../_lib/cors';
import { supabaseAdmin } from '../../_lib/supabase';
import {
  isX402Configured,
  generatePaymentRequirement,
  parseX402Header,
  verifyX402Payment,
  recordX402Payment,
} from '../../_lib/x402-provider';

// In-memory nonce store (cleared on cold start — acceptable for serverless)
const pendingRequirements = new Map<string, {
  requirement: ReturnType<typeof generatePaymentRequirement>;
  skillId: string;
}>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (cors(req, res)) return;

  const { skillId } = req.query;

  if (req.method === 'GET') {
    return handleGet(req, res, skillId as string);
  } else if (req.method === 'POST') {
    return handlePost(req, res, skillId as string);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req: VercelRequest, res: VercelResponse, skillId: string) {
  try {
    // Check X-PAYMENT header on GET too
    const paymentHeader = req.headers['x-payment'] as string | undefined;
    if (paymentHeader) {
      return handleAgentPayment(req, res, skillId, paymentHeader);
    }

    const { data: skill } = await supabaseAdmin
      .from('skills')
      .select('id, name, pricing_model, price_amount, x402_resource_url')
      .eq('id', skillId)
      .single();

    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    if (skill.pricing_model === 'free' || skill.price_amount === 0) {
      return res.json({ access: 'granted', skillId, message: 'This skill is free to use' });
    }

    if (!isX402Configured()) {
      return res.status(503).json({ error: 'x402 payment receiver not configured' });
    }

    const host = req.headers.host || 'candy-shop.democra.ai';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const resource = skill.x402_resource_url || `${protocol}://${host}/api/x402/skill/${skillId}`;
    const usdcAmount = skill.price_amount * 10000;

    const requirement = generatePaymentRequirement({ skillId, amount: usdcAmount, resource });
    pendingRequirements.set(requirement.nonce, { requirement, skillId });

    res.status(402).json({
      status: 402,
      message: 'Payment Required',
      accepts: [requirement],
      'x-payment-required': true,
    });
  } catch (err) {
    console.error('x402 GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse, skillId: string) {
  const paymentHeader = req.headers['x-payment'] as string | undefined;
  if (!paymentHeader) return res.status(400).json({ error: 'Missing X-PAYMENT header' });
  return handleAgentPayment(req, res, skillId, paymentHeader);
}

async function handleAgentPayment(
  req: VercelRequest,
  res: VercelResponse,
  skillId: string,
  paymentHeader: string,
) {
  try {
    const payload = parseX402Header(paymentHeader);
    if (!payload) return res.status(400).json({ error: 'Invalid X-PAYMENT header format' });

    const pending = pendingRequirements.get(payload.paymentDetails.nonce);
    if (!pending) return res.status(400).json({ error: 'Unknown or expired payment nonce' });
    if (pending.skillId !== skillId) return res.status(400).json({ error: 'Skill ID mismatch' });

    const verification = await verifyX402Payment(payload, pending.requirement);
    if (!verification.valid) {
      return res.status(402).json({ error: 'Payment verification failed', reason: verification.error });
    }

    const userId = req.body?.userId || payload.payer;
    await recordX402Payment({
      userId,
      skillId,
      payer: payload.payer,
      amount: verification.amount || 0,
      nonce: payload.paymentDetails.nonce,
    });

    pendingRequirements.delete(payload.paymentDetails.nonce);

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
