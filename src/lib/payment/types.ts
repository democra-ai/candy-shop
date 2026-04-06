// ============================================================
// Payment Types — Dual-layer: Stripe + x402 Protocol
// ============================================================

/** Supported payment providers */
export type PaymentProvider = 'stripe' | 'x402';

/** Pricing model for a skill */
export type PricingModel = 'free' | 'one_time' | 'per_call' | 'subscription';

/** Payment status lifecycle */
export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'expired';

/** Currency — fiat for Stripe, crypto for x402 */
export type Currency = 'usd' | 'eur' | 'cny' | 'USDC' | 'ETH' | 'BASE_ETH';

// ── Skill Pricing ───────────────────────────────────────────

export interface SkillPricing {
  skillId: string;
  model: PricingModel;
  /** Price in smallest unit (cents for fiat, wei/base-units for crypto) */
  amount: number;
  currency: Currency;
  /** For per_call pricing: price per single invocation */
  perCallAmount?: number;
  /** For subscription: interval */
  subscriptionInterval?: 'monthly' | 'yearly';
  /** x402 paywall resource URI (e.g. skill execution endpoint) */
  x402ResourceUrl?: string;
}

// ── Checkout ────────────────────────────────────────────────

export interface CheckoutRequest {
  skillIds: string[];
  provider: PaymentProvider;
  /** Caller: user browser or autonomous agent */
  callerType: 'user' | 'agent';
  /** For x402: the agent's wallet address */
  agentWalletAddress?: string;
  /** Return URL after Stripe checkout */
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutResponse {
  /** Stripe: checkout session URL; x402: payment facilitation URI */
  checkoutUrl?: string;
  /** Session/transaction ID */
  sessionId: string;
  provider: PaymentProvider;
  /** x402: payment details for the 402 response */
  x402PaymentDetails?: X402PaymentDetails;
}

// ── Purchase Record ─────────────────────────────────────────

export interface Purchase {
  id: string;
  userId: string;
  skillId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  /** Stripe: payment intent ID; x402: on-chain tx hash */
  externalId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

// ── x402 Protocol Types ─────────────────────────────────────
// Based on the x402 HTTP payment protocol standard
// See: https://www.x402.org/

export interface X402PaymentDetails {
  /** The resource being paid for */
  resource: string;
  /** Payment scheme (e.g., 'exact') */
  scheme: 'exact';
  /** Network for settlement */
  network: 'base-sepolia' | 'base' | 'ethereum';
  /** Token contract address (USDC, etc.) */
  paymentToken: string;
  /** Amount in token base units */
  maxAmountRequired: string;
  /** Recipient address */
  payTo: string;
  /** Nonce to prevent replay */
  nonce: string;
  /** Expiry timestamp */
  expiry: number;
}

export interface X402PaymentPayload {
  /** Signed payment authorization from agent/wallet */
  signature: string;
  /** Payment details that were signed */
  paymentDetails: X402PaymentDetails;
  /** Payer's address */
  payer: string;
}

// ── Webhook Event ───────────────────────────────────────────

export interface PaymentWebhookEvent {
  provider: PaymentProvider;
  eventType: 'checkout.completed' | 'payment.succeeded' | 'payment.failed' | 'x402.settled';
  externalId: string;
  data: Record<string, unknown>;
}

// ── Provider Interface ──────────────────────────────────────
// Each payment provider implements this interface

export interface PaymentProviderInterface {
  readonly name: PaymentProvider;

  /** Create a checkout session for one or more skills */
  createCheckout(request: CheckoutRequest, items: SkillPricing[]): Promise<CheckoutResponse>;

  /** Verify a payment/purchase is valid and completed */
  verifyPayment(sessionId: string): Promise<Purchase | null>;

  /** Process a webhook event from the provider */
  handleWebhook(rawBody: string | Buffer, signature: string): Promise<PaymentWebhookEvent>;
}

// ── Entitlement ─────────────────────────────────────────────
// What the user/agent is allowed to access after payment

export interface Entitlement {
  userId: string;
  skillId: string;
  type: 'permanent' | 'subscription' | 'per_call';
  /** For per_call: remaining invocations */
  remainingCalls?: number;
  /** For subscription: current period end */
  expiresAt?: string;
  grantedAt: string;
  provider: PaymentProvider;
  purchaseId: string;
}
