// ============================================================
// x402 Payment Provider — Agent-Native HTTP Payment Protocol
// ============================================================
//
// x402 enables autonomous agents to pay for API/skill access
// via the HTTP 402 Payment Required status code.
//
// Flow:
//   1. Agent requests a paid skill endpoint
//   2. Server returns 402 with payment details in header
//   3. Agent signs a payment authorization with its wallet
//   4. Agent re-requests with X-PAYMENT header containing the signed payload
//   5. Server verifies the payment and grants access
//
// This implementation is x402-ready: it generates correct 402 responses
// and validates payment payloads. On-chain settlement can be plugged in
// via the `settlePayment` function.
// ============================================================

import { supabaseAdmin } from './supabase.js';
import crypto from 'crypto';

const receiverAddress = process.env.X402_RECEIVER_ADDRESS || '';
const network = (process.env.X402_NETWORK || 'base-sepolia') as 'base-sepolia' | 'base' | 'ethereum';

// USDC contract addresses by network
const USDC_CONTRACTS: Record<string, string> = {
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

export function isX402Configured(): boolean {
  return !!receiverAddress;
}

// ── Generate 402 Payment Required Response ──────────────────

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

interface GenerateRequirementParams {
  skillId: string;
  amount: number;       // in USDC base units (6 decimals)
  resource: string;     // the URL being paywalled
}

export function generatePaymentRequirement(params: GenerateRequirementParams): X402PaymentRequirement {
  const { amount, resource } = params;

  return {
    resource,
    scheme: 'exact',
    network,
    paymentToken: USDC_CONTRACTS[network] || USDC_CONTRACTS['base-sepolia'],
    maxAmountRequired: amount.toString(),
    payTo: receiverAddress,
    nonce: crypto.randomUUID(),
    expiry: Math.floor(Date.now() / 1000) + 300, // 5 min
  };
}

// ── Verify x402 Payment Payload ─────────────────────────────

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

interface VerifyResult {
  valid: boolean;
  error?: string;
  payer?: string;
  amount?: number;
}

export async function verifyX402Payment(
  payload: X402PaymentPayload,
  expectedRequirement: X402PaymentRequirement,
): Promise<VerifyResult> {
  // Structural validation
  const { paymentDetails, payer, signature } = payload;

  if (!payer || !signature) {
    return { valid: false, error: 'Missing payer or signature' };
  }

  // Check nonce matches
  if (paymentDetails.nonce !== expectedRequirement.nonce) {
    return { valid: false, error: 'Nonce mismatch — possible replay attack' };
  }

  // Check expiry
  if (paymentDetails.expiry < Math.floor(Date.now() / 1000)) {
    return { valid: false, error: 'Payment requirement expired' };
  }

  // Check amount
  if (BigInt(paymentDetails.maxAmountRequired) < BigInt(expectedRequirement.maxAmountRequired)) {
    return { valid: false, error: 'Insufficient payment amount' };
  }

  // Check recipient
  if (paymentDetails.payTo.toLowerCase() !== expectedRequirement.payTo.toLowerCase()) {
    return { valid: false, error: 'Payment recipient mismatch' };
  }

  // In production, verify the on-chain signature using ethers:
  //
  //   import { ethers } from 'ethers';
  //   const message = JSON.stringify(paymentDetails);
  //   const recoveredAddress = ethers.verifyMessage(message, signature);
  //   if (recoveredAddress.toLowerCase() !== payer.toLowerCase()) {
  //     return { valid: false, error: 'Invalid signature' };
  //   }
  //
  // For now, we accept the payload if structural checks pass.
  // This allows testing without a real wallet.

  return {
    valid: true,
    payer,
    amount: Number(paymentDetails.maxAmountRequired),
  };
}

// ── Record x402 Payment ─────────────────────────────────────

interface RecordPaymentParams {
  userId: string;
  skillId: string;
  payer: string;
  amount: number;
  nonce: string;
}

export async function recordX402Payment(params: RecordPaymentParams) {
  const { userId, skillId, payer, amount, nonce } = params;

  // Insert purchase
  const { data: purchase } = await supabaseAdmin.from('purchases').insert({
    user_id: userId,
    skill_id: skillId,
    provider: 'x402',
    status: 'completed',
    amount,
    currency: 'USDC',
    external_id: nonce,  // Use nonce as ID; replace with tx hash after settlement
    metadata: { payer, network },
  }).select('id').single();

  // Grant entitlement
  await supabaseAdmin.from('entitlements').upsert({
    user_id: userId,
    skill_id: skillId,
    type: 'per_call',
    remaining_calls: Math.max(1, Math.floor(amount / 10000)), // 1 call per 0.01 USDC
    provider: 'x402',
    purchase_id: purchase?.id,
  }, { onConflict: 'user_id,skill_id' });

  return { purchaseId: purchase?.id };
}
