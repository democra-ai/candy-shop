#!/usr/bin/env bash
# ============================================================
# D1-based Tier-2 (TEE) smoke test, against `wrangler dev`.
# ============================================================
# Validates the full Worker tier-2 path without a real CVM:
#   1. Start a guest session
#   2. Upsert a tier-2 skill pointing at the mock TEE
#   3. POST /api/skill/:id/run, assert SSE delta + attestation events
#   4. Assert a row in D1 tee_attestations (via `wrangler d1 execute`)
#
# Prereqs (run in 3 terminals):
#   1) phala simulator start          (optional, just for parallel TDX tests)
#   2) TEE_PLATFORM_SIGNING_KEY=$(openssl rand -hex 32) \
#      node scripts/mock-tee.mjs
#   3) wrangler dev --local --config worker/wrangler.toml \
#        --var TEE_PLATFORM_SIGNING_KEY:<same as above> \
#        --var BYOK_ENC_KEY:test-byok-key
#
# Then run: ./scripts/tee-d1-smoke.sh
# ============================================================

set -euo pipefail

: "${WORKER_BASE:=http://127.0.0.1:8787}"
: "${TEE_BASE:=http://127.0.0.1:8080}"
: "${TEE_CODE_HASH:?Run mock-tee.mjs first and export TEE_CODE_HASH from its stdout}"

SKILL_ID="smoke-tee-$(uuidgen | tr '[:upper:]' '[:lower:]' | head -c 8)"
COOKIE=$(mktemp)
trap "rm -f $COOKIE" EXIT

say() { printf '\033[1;36m[d1-smoke]\033[0m %s\n' "$*"; }
ok()  { printf '\033[1;32m[ OK ]\033[0m %s\n' "$*"; }
fail(){ printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

say "1. Auth as guest…"
curl -fsS -c "$COOKIE" -X POST "$WORKER_BASE/api/auth/guest" >/dev/null
ok "guest session"

say "2. Upsert tier-2 skill ($SKILL_ID)…"
curl -fsS -b "$COOKIE" -X POST "$WORKER_BASE/api/skills/upsert" \
  -H 'Content-Type: application/json' \
  -d "$(cat <<EOF
{
  "id": "$SKILL_ID",
  "name": "TEE Smoke Skill",
  "description": "Routed to mock CVM",
  "executionModel": "tee",
  "pricingModel": "free",
  "teeConfig": {
    "provider": "phala",
    "endpoint": "$TEE_BASE",
    "codeHash": "$TEE_CODE_HASH"
  }
}
EOF
)" | grep -q '"ok":true' || fail "upsert failed"
ok "tier-2 skill upserted"

say "3. Invoke through tier-2 dispatch…"
RESP=$(curl -fsS -N -b "$COOKIE" -X POST "$WORKER_BASE/api/skill/$SKILL_ID/run" \
  -H 'Content-Type: application/json' \
  -d '{"input":"hello tee"}' --max-time 15)
echo "$RESP" | grep -q 'event: delta'      || fail "no delta in SSE"
echo "$RESP" | grep -q 'event: attestation' || fail "no attestation event"
echo "$RESP" | grep -q 'event: done'        || fail "no done event"
ok "SSE stream complete (delta + attestation + done)"

say "4. Assert D1 tee_attestations row…"
ROWS=$(npx wrangler d1 execute candy-shop-db --local --config worker/wrangler.toml \
  --command "SELECT COUNT(*) AS n FROM tee_attestations WHERE skill_id='$SKILL_ID' AND valid=1" \
  --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['results'][0]['n'])")
[[ "$ROWS" -ge 1 ]] || fail "expected ≥1 attestation row, got $ROWS"
ok "D1 has $ROWS valid attestation row(s) for $SKILL_ID"

say "All Tier-2 smoke assertions passed ✓"
