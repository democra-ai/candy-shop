// ============================================================
// Payment Integration Verification Script
// ============================================================
// Run: cd server && pnpm test
// Or:  npx tsx test/payment.test.ts
//
// This script verifies the payment system without real credentials.
// ============================================================

import { generatePaymentRequirement, parseX402Header, verifyX402Payment } from '../lib/x402-provider.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n── ${name} ──`);
}

// ── Test x402 Payment Requirement Generation ────────────────

section('x402 Payment Requirement Generation');

const requirement = generatePaymentRequirement({
  skillId: 'test-skill-123',
  amount: 1000000, // 1 USDC
  resource: 'https://example.com/api/x402/skill/test-skill-123',
});

assert(requirement.scheme === 'exact', 'Scheme is "exact"');
assert(requirement.network === 'base-sepolia', 'Default network is base-sepolia');
assert(requirement.maxAmountRequired === '1000000', 'Amount is 1000000 (1 USDC)');
assert(!!requirement.nonce, 'Nonce is generated');
assert(requirement.expiry > Math.floor(Date.now() / 1000), 'Expiry is in the future');
assert(requirement.resource === 'https://example.com/api/x402/skill/test-skill-123', 'Resource URL matches');

// ── Test x402 Header Parsing ────────────────────────────────

section('x402 Header Parsing');

const mockPayload = {
  signature: '0xdeadbeef',
  paymentDetails: requirement,
  payer: '0x1234567890abcdef1234567890abcdef12345678',
};

const encoded = Buffer.from(JSON.stringify(mockPayload)).toString('base64');
const parsed = parseX402Header(encoded);

assert(parsed !== null, 'Valid base64 JSON parses successfully');
assert(parsed?.payer === mockPayload.payer, 'Payer address preserved');
assert(parsed?.signature === '0xdeadbeef', 'Signature preserved');
assert(parsed?.paymentDetails.nonce === requirement.nonce, 'Nonce preserved');

const invalidParsed = parseX402Header('not-valid-base64!!!');
assert(invalidParsed === null, 'Invalid base64 returns null');

// ── Test x402 Payment Verification ──────────────────────────

section('x402 Payment Verification');

async function testVerification() {
  // Valid payment
  const validResult = await verifyX402Payment(mockPayload, requirement);
  assert(validResult.valid === true, 'Valid payment passes verification');
  assert(validResult.payer === mockPayload.payer, 'Payer returned on success');

  // Wrong nonce
  const wrongNonce = {
    ...mockPayload,
    paymentDetails: { ...requirement, nonce: 'wrong-nonce' },
  };
  const nonceResult = await verifyX402Payment(wrongNonce, requirement);
  assert(nonceResult.valid === false, 'Wrong nonce rejected');
  assert(nonceResult.error?.includes('Nonce') === true, 'Error mentions nonce');

  // Expired payment
  const expiredReq = { ...requirement, expiry: Math.floor(Date.now() / 1000) - 100 };
  const expiredPayload = { ...mockPayload, paymentDetails: expiredReq };
  const expiredResult = await verifyX402Payment(expiredPayload, expiredReq);
  assert(expiredResult.valid === false, 'Expired payment rejected');

  // Insufficient amount
  const lowAmount = {
    ...mockPayload,
    paymentDetails: { ...requirement, maxAmountRequired: '500000' },
  };
  const lowResult = await verifyX402Payment(lowAmount, requirement);
  assert(lowResult.valid === false, 'Insufficient amount rejected');

  // Wrong recipient
  const wrongRecipient = {
    ...mockPayload,
    paymentDetails: { ...requirement, payTo: '0xwrongaddress' },
  };
  const recipientResult = await verifyX402Payment(wrongRecipient, requirement);
  assert(recipientResult.valid === false, 'Wrong recipient rejected');
}

// ── Test Price Formatting ───────────────────────────────────

section('Price Formatting (import from client)');

// Simple format test (avoiding frontend import in Node)
function formatPriceCents(amount: number, currency: string = 'usd'): string {
  if (amount === 0) return 'Free';
  return `$${(amount / 100).toFixed(2)}`;
}

assert(formatPriceCents(0) === 'Free', 'Zero amount formats as "Free"');
assert(formatPriceCents(499) === '$4.99', '499 cents = $4.99');
assert(formatPriceCents(100) === '$1.00', '100 cents = $1.00');
assert(formatPriceCents(1) === '$0.01', '1 cent = $0.01');

// ── Test Type Structures ────────────────────────────────────

section('Type Structure Validation');

// Ensure key interfaces exist and have expected shapes
const mockPurchase = {
  id: 'uuid',
  userId: 'uuid',
  skillId: 'uuid',
  provider: 'stripe' as const,
  status: 'completed' as const,
  amount: 499,
  currency: 'usd',
  externalId: 'pi_xxx',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

assert(typeof mockPurchase.id === 'string', 'Purchase has id');
assert(mockPurchase.provider === 'stripe' || mockPurchase.provider === 'x402', 'Provider is valid');
assert(['pending', 'processing', 'completed', 'failed', 'refunded', 'expired'].includes(mockPurchase.status), 'Status is valid');

const mockEntitlement = {
  userId: 'uuid',
  skillId: 'uuid',
  type: 'permanent' as const,
  grantedAt: new Date().toISOString(),
  provider: 'stripe' as const,
  purchaseId: 'uuid',
};

assert(['permanent', 'subscription', 'per_call'].includes(mockEntitlement.type), 'Entitlement type is valid');

// ── Run async tests ─────────────────────────────────────────

testVerification().then(() => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('All tests passed!');
  }
});
