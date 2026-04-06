# Payment Architecture — Candy Shop

## Overview

Candy Shop implements a **dual-layer payment system** for AI skill marketplace transactions:

1. **Layer 1 (Stripe)** — Traditional payment for human users via browser checkout
2. **Layer 2 (x402)** — Agent-native HTTP payment protocol for autonomous AI agents

Both layers share a common data model (purchases, entitlements) in Supabase.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  CartDrawer → usePayment hook → payment-client.ts       │
└───────────────┬──────────────────────┬──────────────────┘
                │                      │
          ┌─────▼─────┐         ┌──────▼──────┐
          │   Stripe   │         │    x402     │
          │  Checkout  │         │  Protocol   │
          └─────┬─────┘         └──────┬──────┘
                │                      │
┌───────────────▼──────────────────────▼──────────────────┐
│              Payment Server (Express)                    │
│  /api/payment/*  — Stripe checkout, verify, entitlements │
│  /api/webhook/*  — Stripe webhook handler                │
│  /api/x402/*     — x402 payment protocol endpoints       │
└───────────────┬──────────────────────┬──────────────────┘
                │                      │
          ┌─────▼─────┐         ┌──────▼──────┐
          │  Stripe    │         │   On-chain  │
          │  API       │         │  (USDC/Base)│
          └─────┬─────┘         └──────┬──────┘
                │                      │
┌───────────────▼──────────────────────▼──────────────────┐
│                Supabase (PostgreSQL)                      │
│  purchases | entitlements | checkout_sessions | skills    │
└─────────────────────────────────────────────────────────┘
```

## Data Model

### Skills (extended)
- `pricing_model`: `free` | `one_time` | `per_call` | `subscription`
- `price_amount`: Price in cents (e.g., 499 = $4.99)
- `price_currency`: `usd` | `eur` etc.
- `stripe_price_id`: Optional Stripe Price ID for recurring
- `x402_resource_url`: The paywalled resource URL

### Purchases
Tracks every completed payment transaction:
- `provider`: `stripe` | `x402`
- `status`: `pending` → `completed` / `failed` / `refunded`
- `external_id`: Stripe payment_intent ID or x402 tx nonce

### Entitlements
What the user/agent can access after paying:
- `type`: `permanent` | `subscription` | `per_call`
- `remaining_calls`: For per-call billing
- `expires_at`: For subscriptions

## Stripe Flow

```
User clicks "Pay $X" in CartDrawer
  → POST /api/payment/checkout { skillIds, userId }
  → Server creates Stripe Checkout Session
  → User redirected to Stripe hosted checkout
  → User pays
  → Stripe sends webhook to POST /api/webhook/stripe
  → Server creates purchase + entitlement records
  → User returns to success URL
  → Frontend verifies via GET /api/payment/verify/:sessionId
```

### Setting Up Stripe

1. Create a [Stripe account](https://dashboard.stripe.com/register)
2. Get your test API keys from the Dashboard
3. Set environment variables:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. For local webhook testing, use Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3001/api/webhook/stripe
   ```

## x402 Flow (Agent-Native)

The x402 protocol enables autonomous agents to pay for skill access using HTTP status code 402:

```
Agent GET /api/x402/skill/:id
  ← 402 Payment Required + JSON payment details
Agent signs payment with wallet
Agent POST /api/x402/skill/:id  (X-PAYMENT header = base64 signed payload)
  → Server verifies signature + payment details
  → Records purchase + grants entitlement
  ← 200 OK { access: "granted" }
```

### x402 Payment Details Format

```json
{
  "resource": "https://api.candy.shop/api/x402/skill/abc123",
  "scheme": "exact",
  "network": "base-sepolia",
  "paymentToken": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "maxAmountRequired": "1000000",
  "payTo": "0xYourAddress",
  "nonce": "uuid",
  "expiry": 1712345678
}
```

### Setting Up x402

1. Set the receiving wallet address:
   ```bash
   X402_RECEIVER_ADDRESS=0xYourWalletAddress
   X402_NETWORK=base-sepolia  # or base, ethereum
   ```
2. The server will generate 402 responses for paid skills
3. Agent clients need an EVM wallet to sign payment authorizations

## Local Development

### 1. Start the frontend
```bash
pnpm dev
```

### 2. Start the payment server
```bash
cd server
cp .env.example .env  # Edit with your keys
pnpm install
pnpm dev
```

The Vite dev server proxies `/api` to `localhost:3001` automatically.

### 3. Test Stripe webhooks locally
```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to localhost:3001/api/webhook/stripe
```

### 4. Test x402 protocol
```bash
# Request skill (get 402 response)
curl -i http://localhost:3001/api/x402/skill/SKILL_ID

# Check pricing info
curl http://localhost:3001/api/x402/pricing/SKILL_ID
```

## Graceful Degradation

The system is designed to work without payment infrastructure:

- **No Stripe key**: All purchases go through as free (demo mode)
- **No x402 config**: Agent endpoints return 503
- **No payment server**: Frontend installs skills locally without payment
- **No Supabase**: Payment records are not persisted (server warns on startup)

The `usePayment` hook checks server health on mount and reports which providers
are available. CartDrawer adapts its UI based on this.

## File Structure

```
src/
  lib/payment/
    types.ts           — Shared type definitions (both layers)
    payment-client.ts  — Frontend API calls
    index.ts           — Barrel export
  hooks/
    usePayment.ts      — React hook for checkout + entitlements

server/
  index.ts             — Express entry point
  lib/
    supabase.ts        — Admin Supabase client
    stripe-provider.ts — Stripe checkout + webhook logic
    x402-provider.ts   — x402 protocol implementation
  routes/
    payment.ts         — Stripe checkout, verify, access check
    webhook.ts         — Stripe webhook handler
    x402.ts            — x402 protocol endpoints

supabase/migrations/
  002_payments.sql     — Payment tables + RPC functions
```

## Security Considerations

- Stripe webhook signatures are verified via `constructEvent()`
- x402 payment nonces prevent replay attacks
- Supabase RLS ensures users can only see their own purchases/entitlements
- Server uses service role key (never exposed to frontend)
- Price amounts come from the database, not the client
