// x402 Payment Provider for Vercel Serverless Functions
import { supabaseAdmin } from './supabase';
import crypto from 'crypto';

const receiverAddress = process.env.X402_RECEIVER_ADDRESS || '';
const network = (process.env.X402_NETWORK || 'base-sepolia') as 'base-sepolia' | 'base' | 'ethereum';

const USDC_CONTRACTS: Record<string, string> = {
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

export function isX402Configured(): boolean {
  return !!receiverAddress;
}

export interface X402PaymentRequirement {
  resource: string;
  scheme: 'exact';
  network: string;
  paymentToken: string;
  maxAmountRequired: string;
  payTo: string;
  nonce: string;
  expiry: number;
}

export function generatePaymentRequirement(params: {
  skillId: string;
  amount: number;
  resource: string;
}): X402PaymentRequirement {
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

interface X402PaymentPayload {
  signature: string;
  paymentDetails: X402PaymentRequirement;
  payer: string;
}

export function parseX402Header(headerValue: string): X402PaymentPayload | null {
  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function verifyX402Payment(
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

export async function recordX402Payment(params: {
  userId: string;
  skillId: string;
  payer: string;
  amount: number;
  nonce: string;
}) {
  const { userId, skillId, payer, amount, nonce } = params;

  const { data: purchase } = await supabaseAdmin.from('purchases').insert({
    user_id: userId,
    skill_id: skillId,
    provider: 'x402',
    status: 'completed',
    amount,
    currency: 'USDC',
    external_id: nonce,
    metadata: { payer, network },
  }).select('id').single();

  await supabaseAdmin.from('entitlements').upsert({
    user_id: userId,
    skill_id: skillId,
    type: 'per_call',
    remaining_calls: Math.max(1, Math.floor(amount / 10000)),
    provider: 'x402',
    purchase_id: purchase?.id,
  }, { onConflict: 'user_id,skill_id' });

  return { purchaseId: purchase?.id };
}
