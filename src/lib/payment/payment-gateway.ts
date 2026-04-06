// ============================================================
// Unified Payment Gateway — Stripe + x402 Abstraction Layer
// ============================================================
//
// Single interface for all payment operations regardless of
// whether the caller is a human (Stripe) or an agent (x402).
//
// Key design:
//   - Detect caller type automatically
//   - Route to appropriate provider
//   - Normalize responses
//   - Support execution rights (not downloads)
// ============================================================

import {
  createCheckout,
  checkAccess,
  getEntitlements,
  invokeSkill,
  formatPrice,
  type InvokeParams,
  type InvokeResult,
} from './payment-client';
import type {
  PaymentProvider,
  Entitlement,
  PricingModel,
} from './types';

// ── Unified Gateway Interface ──────────────────────────────

export interface PaymentGateway {
  /** Determine the best payment method for this caller */
  resolveProvider(callerType: 'user' | 'agent'): PaymentProvider;

  /** Purchase execution rights for skills */
  purchaseRights(params: PurchaseParams): Promise<PurchaseResult>;

  /** Invoke a skill (checks entitlement, pays if needed) */
  invoke(params: InvokeParams): Promise<InvokeResult>;

  /** Check if caller has execution rights */
  hasRights(callerId: string, skillId: string): Promise<boolean>;

  /** Get all execution rights for a caller */
  getRights(callerId: string): Promise<Entitlement[]>;

  /** Format a price for display */
  formatAmount(amount: number, currency?: string): string;
}

export interface PurchaseParams {
  skillIds: string[];
  callerId: string;
  callerType: 'user' | 'agent';
  /** For agents: wallet address */
  walletAddress?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PurchaseResult {
  provider: PaymentProvider;
  sessionId: string;
  checkoutUrl?: string;
  /** True if all skills were free */
  free: boolean;
}

// ── Gateway Implementation ─────────────────────────────────

class UnifiedPaymentGateway implements PaymentGateway {
  resolveProvider(callerType: 'user' | 'agent'): PaymentProvider {
    // Agents default to x402 (crypto-native), humans to Stripe
    return callerType === 'agent' ? 'x402' : 'stripe';
  }

  async purchaseRights(params: PurchaseParams): Promise<PurchaseResult> {
    const provider = this.resolveProvider(params.callerType);

    if (provider === 'stripe') {
      const result = await createCheckout({
        skillIds: params.skillIds,
        userId: params.callerId,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      });

      return {
        provider: result.provider,
        sessionId: result.sessionId,
        checkoutUrl: result.checkoutUrl ?? undefined,
        free: result.sessionId === 'free',
      };
    }

    // x402: agent flow — invoke directly, payment happens inline
    return {
      provider: 'x402',
      sessionId: 'x402-' + Date.now(),
      free: false,
    };
  }

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    return invokeSkill(params);
  }

  async hasRights(callerId: string, skillId: string): Promise<boolean> {
    try {
      const result = await checkAccess(callerId, skillId);
      return result.hasAccess;
    } catch {
      return false;
    }
  }

  async getRights(callerId: string): Promise<Entitlement[]> {
    try {
      return await getEntitlements(callerId);
    } catch {
      return [];
    }
  }

  formatAmount(amount: number, currency: string = 'usd'): string {
    return formatPrice(amount, currency);
  }
}

// Singleton gateway instance
export const paymentGateway = new UnifiedPaymentGateway();

// ── Revenue Split Calculator ───────────────────────────────
// Calculates revenue distribution based on skill lineage

export interface RevenueBreakdown {
  originalAuthor: number;  // cents
  operator: number;
  platform: number;
  total: number;
}

const DEFAULT_SPLITS: Record<string, { original: number; operator: number; platform: number }> = {
  original:            { original: 0,  operator: 85, platform: 15 },
  fork:                { original: 15, operator: 70, platform: 15 },
  remix:               { original: 20, operator: 65, platform: 15 },
  licensed_derivative:  { original: 25, operator: 60, platform: 15 },
};

export function calculateRevenueSplit(
  totalAmount: number,
  lineageType: string = 'original',
): RevenueBreakdown {
  const split = DEFAULT_SPLITS[lineageType] || DEFAULT_SPLITS.original;
  return {
    originalAuthor: Math.round(totalAmount * split.original / 100),
    operator: Math.round(totalAmount * split.operator / 100),
    platform: Math.round(totalAmount * split.platform / 100),
    total: totalAmount,
  };
}

/** Pricing model display helpers */
export function getPricingModelLabel(model: PricingModel): string {
  const labels: Record<PricingModel, string> = {
    free: 'Free',
    one_time: 'One-time purchase',
    per_call: 'Pay per invocation',
    subscription: 'Subscription',
  };
  return labels[model] || model;
}

export function getPricingModelDescription(model: PricingModel): string {
  const descriptions: Record<PricingModel, string> = {
    free: 'No payment required — open access',
    one_time: 'Buy once, invoke unlimited times',
    per_call: 'Pay for each execution — both humans (Stripe) and agents (x402)',
    subscription: 'Monthly/yearly access to unlimited invocations',
  };
  return descriptions[model] || '';
}
