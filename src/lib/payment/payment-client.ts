// ============================================================
// Payment Client — Frontend API for Stripe + x402
// ============================================================

import axios from 'axios';
import type {
  PaymentProvider,
  CheckoutResponse,
  Purchase,
  Entitlement,
  SkillPricing,
} from './types';

const API_BASE = import.meta.env.VITE_PAYMENT_API_URL || '/api';

const client = axios.create({ baseURL: API_BASE });

// ── Stripe Checkout ─────────────────────────────────────────

export interface CreateCheckoutParams {
  skillIds: string[];
  userId: string;
  successUrl?: string;
  cancelUrl?: string;
}

export async function createCheckout(params: CreateCheckoutParams): Promise<CheckoutResponse> {
  const { data } = await client.post('/payment/checkout', params);

  // If all skills are free, return a "free" response
  if (data.free) {
    return {
      sessionId: 'free',
      provider: 'stripe' as PaymentProvider,
    };
  }

  return {
    sessionId: data.sessionId,
    checkoutUrl: data.checkoutUrl,
    provider: data.provider,
  };
}

// ── Verify Payment ──────────────────────────────────────────

export async function verifyPayment(sessionId: string): Promise<{
  paid: boolean;
  status: string;
  skillIds: string[];
}> {
  const { data } = await client.get(`/payment/verify/${sessionId}`);
  return data;
}

// ── Entitlements ────────────────────────────────────────────

export async function getEntitlements(userId: string): Promise<Entitlement[]> {
  const { data } = await client.get(`/payment/entitlements/${userId}`);
  return data.entitlements || [];
}

// ── Purchases ───────────────────────────────────────────────

export async function getPurchases(userId: string): Promise<Purchase[]> {
  const { data } = await client.get(`/payment/purchases/${userId}`);
  return data.purchases || [];
}

// ── Access Check ────────────────────────────────────────────

export async function checkAccess(userId: string, skillId: string): Promise<{
  hasAccess: boolean;
  reason: 'free' | 'purchased' | 'payment_required';
}> {
  const { data } = await client.get(`/payment/check/${userId}/${skillId}`);
  return data;
}

// ── x402 Pricing Info ───────────────────────────────────────

export async function getX402Pricing(skillId: string): Promise<{
  skillId: string;
  pricingModel: string;
  fiat: { amount: number; currency: string; display: string };
  x402: { network: string; token: string; amount: number; configured: boolean } | null;
}> {
  const { data } = await client.get(`/x402/pricing/${skillId}`);
  return data;
}

// ── Server Health ───────────────────────────────────────────

export async function checkPaymentHealth(): Promise<{
  status: string;
  providers: { stripe: boolean; x402: boolean };
}> {
  try {
    const { data } = await client.get('/health');
    return data;
  } catch {
    return { status: 'unavailable', providers: { stripe: false, x402: false } };
  }
}

// ── Helpers ─────────────────────────────────────────────────

/** Format a price amount (in cents) to display string */
export function formatPrice(amount: number, currency: string = 'usd'): string {
  if (amount === 0) return 'Free';
  const fiatCurrencies = ['usd', 'eur', 'cny'];
  if (fiatCurrencies.includes(currency.toLowerCase())) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  }
  // Crypto
  return `${amount} ${currency}`;
}

/** Determine if a skill requires payment based on its pricing */
export function requiresPayment(pricing?: SkillPricing): boolean {
  if (!pricing) return false;
  return pricing.model !== 'free' && pricing.amount > 0;
}

// ── Skill Invocation (Execution Rights) ────────────────────

export interface InvokeParams {
  skillId: string;
  callerId: string;
  callerType?: 'user' | 'agent';
  input?: Record<string, unknown>;
}

export interface InvokeResult {
  invocationId: string;
  skillId: string;
  status: 'success' | 'payment_required' | 'error';
  message: string;
  remainingCalls?: number | null;
  paymentOptions?: { stripe: boolean; x402: boolean };
}

/** Invoke a skill — checks entitlement and consumes a call */
export async function invokeSkill(params: InvokeParams): Promise<InvokeResult> {
  try {
    const { data } = await client.post(`/invoke/${params.skillId}`, params);
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 402) {
      return {
        invocationId: '',
        skillId: params.skillId,
        status: 'payment_required',
        message: err.response.data?.message || 'Payment required',
        paymentOptions: err.response.data?.paymentOptions,
      };
    }
    throw err;
  }
}

/** Get the public manifest for a skill (always visible) */
export async function getSkillManifest(skillId: string): Promise<Record<string, unknown>> {
  const { data } = await client.get(`/invoke/${skillId}/manifest`);
  return data.manifest;
}

/** Get invocation stats for a skill */
export async function getInvocationStats(skillId: string): Promise<{ totalInvocations: number }> {
  const { data } = await client.get(`/invoke/${skillId}/stats`);
  return data;
}
