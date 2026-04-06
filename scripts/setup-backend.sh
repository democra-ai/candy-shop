#!/bin/bash
# ============================================================
# Candy Shop — Backend Setup & Deployment Script
# ============================================================
# This script helps configure and verify the backend deployment.
#
# Prerequisites:
#   1. Vercel CLI: npm i -g vercel
#   2. Supabase CLI: npm i -g supabase (optional, for migrations)
#   3. A Supabase project (https://supabase.com/dashboard)
#   4. A Stripe account (https://dashboard.stripe.com)
#
# Usage:
#   ./scripts/setup-backend.sh check    — Check current config
#   ./scripts/setup-backend.sh migrate  — Run Supabase migrations
#   ./scripts/setup-backend.sh deploy   — Deploy to Vercel
#   ./scripts/setup-backend.sh verify   — Verify live endpoints
# ============================================================

set -e

LIVE_URL="${CANDY_SHOP_URL:-https://candy-shop.democra.ai}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }

# ── Check ─────────────────────────────────────────────────

cmd_check() {
  echo "=== Candy Shop Backend Config Check ==="
  echo ""

  # Vercel CLI
  if command -v vercel &>/dev/null; then
    ok "Vercel CLI installed ($(vercel --version 2>/dev/null))"
    if vercel whoami &>/dev/null 2>&1; then
      ok "Vercel authenticated as $(vercel whoami 2>/dev/null)"
    else
      warn "Vercel CLI not authenticated (run: vercel login)"
    fi
  else
    warn "Vercel CLI not installed (run: npm i -g vercel)"
  fi

  # Supabase CLI
  if command -v supabase &>/dev/null; then
    ok "Supabase CLI installed ($(supabase --version 2>/dev/null))"
  elif npx supabase --version &>/dev/null 2>&1; then
    ok "Supabase CLI available via npx"
  else
    warn "Supabase CLI not installed (run: npm i -g supabase)"
  fi

  # Check .env files
  if [ -f ".env" ]; then
    ok ".env file exists"
    grep -q "VITE_SUPABASE_URL" .env && ok "VITE_SUPABASE_URL set" || warn "VITE_SUPABASE_URL missing in .env"
    grep -q "VITE_SUPABASE_ANON_KEY" .env && ok "VITE_SUPABASE_ANON_KEY set" || warn "VITE_SUPABASE_ANON_KEY missing in .env"
  else
    warn ".env file missing (copy from .env.example)"
  fi

  # Check Vercel env vars
  echo ""
  echo "--- Vercel Environment Variables (must be set in Vercel Dashboard) ---"
  echo "  Required for backend API to work:"
  echo "    SUPABASE_URL              — Your Supabase project URL"
  echo "    SUPABASE_SERVICE_ROLE_KEY — Service role key (NOT anon key)"
  echo "    VITE_SUPABASE_URL         — Same as SUPABASE_URL"
  echo "    VITE_SUPABASE_ANON_KEY    — Anon/public key"
  echo ""
  echo "  Optional (enables payment features):"
  echo "    STRIPE_SECRET_KEY         — Stripe secret key (sk_test_... or sk_live_...)"
  echo "    STRIPE_WEBHOOK_SECRET     — Stripe webhook signing secret"
  echo "    X402_RECEIVER_ADDRESS     — USDC wallet for x402 agent payments"
  echo "    X402_NETWORK              — base-sepolia | base | ethereum"
  echo ""
}

# ── Migrate ───────────────────────────────────────────────

cmd_migrate() {
  echo "=== Running Supabase Migrations ==="
  echo ""

  if ! command -v supabase &>/dev/null && ! npx supabase --version &>/dev/null 2>&1; then
    fail "Supabase CLI not found. Install with: npm i -g supabase"
    echo ""
    echo "Alternatively, run migrations manually in Supabase SQL Editor:"
    echo "  1. Go to https://supabase.com/dashboard → Your Project → SQL Editor"
    echo "  2. Run each file in order:"
    echo "     - supabase/migrations/001_init.sql"
    echo "     - supabase/migrations/002_payments.sql"
    echo "     - supabase/migrations/003_lineage_and_invocations.sql"
    exit 1
  fi

  SUPABASE_CMD="supabase"
  command -v supabase &>/dev/null || SUPABASE_CMD="npx supabase"

  echo "Linking to Supabase project..."
  $SUPABASE_CMD link || { fail "Failed to link project. Run: supabase login"; exit 1; }

  echo "Pushing migrations..."
  $SUPABASE_CMD db push || { fail "Migration failed"; exit 1; }

  ok "All migrations applied successfully"
}

# ── Deploy ────────────────────────────────────────────────

cmd_deploy() {
  echo "=== Deploying to Vercel ==="
  echo ""

  if ! command -v vercel &>/dev/null; then
    fail "Vercel CLI not found. Install with: npm i -g vercel"
    exit 1
  fi

  echo "Deploying (production)..."
  vercel --prod

  ok "Deployment complete"
  echo ""
  echo "Don't forget to set environment variables in Vercel Dashboard!"
  echo "Run: $0 check  — to see required variables"
}

# ── Verify ─────────���──────────────────────────────────────

cmd_verify() {
  echo "=== Verifying Live API Endpoints ==="
  echo "  URL: ${LIVE_URL}"
  echo ""

  # Health check
  HEALTH=$(curl -sf "${LIVE_URL}/api/health" 2>/dev/null || echo "FAIL")
  if echo "$HEALTH" | grep -q '"status":"ok"'; then
    ok "GET /api/health — OK"
    echo "     $HEALTH"
  else
    fail "GET /api/health — FAILED (returned: $HEALTH)"
  fi

  echo ""
  echo "--- Endpoint Summary ---"
  for endpoint in \
    "GET /api/health" \
    "POST /api/payment/checkout" \
    "GET /api/payment/verify/{sessionId}" \
    "GET /api/payment/entitlements/{userId}" \
    "GET /api/payment/purchases/{userId}" \
    "GET /api/payment/check/{userId}/{skillId}" \
    "GET /api/x402/skill/{skillId}" \
    "POST /api/x402/skill/{skillId}" \
    "GET /api/x402/pricing/{skillId}" \
    "POST /api/invoke/{skillId}" \
    "GET /api/invoke/{skillId}/manifest" \
    "GET /api/invoke/{skillId}/stats" \
    "POST /api/webhook/stripe"
  do
    echo "  $endpoint"
  done
}

# ── Main ─────���────────────────────────────────────────────

case "${1:-check}" in
  check)   cmd_check ;;
  migrate) cmd_migrate ;;
  deploy)  cmd_deploy ;;
  verify)  cmd_verify ;;
  *)
    echo "Usage: $0 {check|migrate|deploy|verify}"
    exit 1
    ;;
esac
