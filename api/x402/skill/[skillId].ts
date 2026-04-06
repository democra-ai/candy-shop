// GET+POST /api/x402/skill/:skillId — x402 protocol endpoint
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

// --- Inline x402 helpers ---
const USDC_CONTRACTS: Record<string, string> = {
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

function getReceiverAddress() { return process.env.X402_RECEIVER_ADDRESS || ''; }
function getNetwork() { return (process.env.X402_NETWORK || 'base-sepolia') as 'base-sepolia' | 'base' | 'ethereum'; }
function isX402Configured(): boolean { return !!getReceiverAddress(); }

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
  const network = getNetwork();
  return {
    resource: params.resource,
    scheme: 'exact',
    network,
    paymentToken: USDC_CONTRACTS[network] || USDC_CONTRACTS['base-sepolia'],
    maxAmountRequired: params.amount.toString(),
    payTo: getReceiverAddress(),
    nonce: crypto.randomUUID(),
    expiry: Math.floor(Date.now() / 1000) + 300,
  };
}

interface X402PaymentPayload {
  signature: string;
  paymentDetails: X402PaymentRequirement;
  payer: string;
}

function parseX402Header(headerValue: string): X402PaymentPayload | null {
  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

async function verifyX402Payment(
  payload: X402PaymentPayload,
  expectedRequirement: X402PaymentRequirement,
): Promise<{ valid: boolean; error?: string; payer?: string; amount?: number }> {
  const { paymentDetails, payer, signature } = payload;
  if (!payer || !signature) return { valid: false, error: 'Missing payer or signature' };
  if (paymentDetails.nonce !== expectedRequirement.nonce) return { valid: false, error: 'Nonce mismatch' };
  if (paymentDetails.expiry < Math.floor(Date.now() / 1000)) return { valid: false, error: 'Payment expired' };
  if (BigInt(paymentDetails.maxAmountRequired) < BigInt(expectedRequirement.maxAmountRequired)) return { valid: false, error: 'Insufficient amount' };
  if (paymentDetails.payTo.toLowerCase() !== expectedRequirement.payTo.toLowerCase()) return { valid: false, error: 'Recipient mismatch' };
  return { valid: true, payer, amount: Number(paymentDetails.maxAmountRequired) };
}

async function recordX402Payment(params: { userId: string; skillId: string; payer: string; amount: number; nonce: string }) {
  const supabase = db();
  if (!supabase) return { purchaseId: null };
  const { userId, skillId, payer, amount, nonce } = params;
  const network = getNetwork();

  const { data: purchase } = await supabase.from('purchases').insert({
    user_id: userId,
    skill_id: skillId,
    provider: 'x402',
    status: 'completed',
    amount,
    currency: 'USDC',
    external_id: nonce,
    metadata: { payer, network },
  }).select('id').single();

  await supabase.from('entitlements').upsert({
    user_id: userId,
    skill_id: skillId,
    type: 'per_call',
    remaining_calls: Math.max(1, Math.floor(amount / 10000)),
    provider: 'x402',
    purchase_id: purchase?.id,
  }, { onConflict: 'user_id,skill_id' });

  return { purchaseId: purchase?.id };
}

// --- In-memory nonce store (cleared on cold start — acceptable for serverless) ---
const pendingRequirements = new Map<string, {
  requirement: X402PaymentRequirement;
  skillId: string;
}>();

// --- Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(204).end();

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
    const supabase = db();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    // Check X-PAYMENT header on GET too
    const paymentHeader = req.headers['x-payment'] as string | undefined;
    if (paymentHeader) {
      return handleAgentPayment(req, res, skillId, paymentHeader);
    }

    const { data: skill } = await supabase
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
