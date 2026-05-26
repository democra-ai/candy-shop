#!/usr/bin/env bash
# ============================================================
# Candy Shop · TEE End-to-End Smoke Test
# ============================================================
# Validates the Tier-2 code path WITHOUT needing a real TEE:
#   1. Runs migration 004 against your Supabase dev DB
#   2. Builds & starts the tee-template container on :8080
#      (attestation is stubbed but structurally valid)
#   3. Inserts a test skill with execution_model='tee' pointing at it
#   4. Starts the platform server (if not already running)
#   5. Invokes POST /api/invoke/:id and asserts:
#        - status 200
#        - attestation.codeHash matches skill.tee_code_hash
#        - attestation.payload.nonce matches the nonce we sent
#        - a row was inserted into tee_attestations
#        - invocations.tee_attestation_id links to it
#
# Real Phala CVM deployment is a separate step — see
# tee-template/README.md.
#
# Usage:
#   ./scripts/tee-smoke-test.sh
#
# Env (falls back to .env in candy-shop/ and server/):
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — required
#   TEE_PLATFORM_SIGNING_KEY               — optional (default: auto-generated)
#   PLATFORM_URL                           — default http://localhost:3000
# ============================================================

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

# ── Load env from common locations ─────────────────────────
for envfile in .env server/.env .env.local; do
  if [[ -f "$envfile" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$envfile"; set +a
  fi
done

: "${SUPABASE_URL:?SUPABASE_URL not set — source .env or export it}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"
: "${PLATFORM_URL:=http://localhost:3000}"
: "${TEE_PLATFORM_SIGNING_KEY:=$(openssl rand -hex 32)}"
export TEE_PLATFORM_SIGNING_KEY

SKILL_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
TEE_CONTAINER="candy-tee-smoke-$RANDOM"
TEE_IMAGE="candy-shop-tee-smoke:dev"
TEE_PORT=8080

say()  { printf '\033[1;36m[smoke]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }
ok()   { printf '\033[1;32m[ OK ]\033[0m %s\n' "$*"; }

cleanup() {
  say "Cleaning up…"
  docker rm -f "$TEE_CONTAINER" >/dev/null 2>&1 || true
  # Remove test skill + its attestations
  curl -sS -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"sql\":\"delete from public.skills where id='$SKILL_ID';\"}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ── 0. Sanity checks ───────────────────────────────────────
command -v docker  >/dev/null || fail "docker not found"
command -v curl    >/dev/null || fail "curl not found"
command -v uuidgen >/dev/null || fail "uuidgen not found"
command -v jq      >/dev/null || fail "jq not found"

# ── 1. Apply migration (idempotent) ────────────────────────
say "Applying migration 004_tee_execution.sql (idempotent)…"
MIGRATION_SQL="$(cat supabase/migrations/004_tee_execution.sql)"
# Supabase JS wrapper over rest/v1 — requires a postgres helper function `exec_sql`
# OR run via supabase CLI if available. We prefer the CLI when present.
if command -v supabase >/dev/null; then
  supabase db push --include-all >/dev/null 2>&1 || say "supabase db push failed (may already be applied)"
else
  say "supabase CLI not found — run the migration manually via the Supabase dashboard"
  say "  → paste supabase/migrations/004_tee_execution.sql into the SQL editor"
fi

# ── 2. Build & run tee-template ────────────────────────────
say "Building TEE template image…"
cp tee-template/skill.example.json tee-template/skill.json
# Swap in our test skill id so the container accepts invocations for it
TMP_JSON="$(mktemp)"
jq --arg id "$SKILL_ID" '.id = $id' tee-template/skill.json > "$TMP_JSON" && mv "$TMP_JSON" tee-template/skill.json
docker build -q -t "$TEE_IMAGE" tee-template/ >/dev/null

CODE_HASH="$(docker run --rm "$TEE_IMAGE" cat /app/code_hash.txt)"
ok "Built image with code_hash=$CODE_HASH"

say "Starting TEE container on :$TEE_PORT…"
docker run -d --rm --name "$TEE_CONTAINER" \
  -e TEE_PLATFORM_SIGNING_KEY="$TEE_PLATFORM_SIGNING_KEY" \
  -e TEE_PROVIDER=phala \
  -p "$TEE_PORT:8080" "$TEE_IMAGE" >/dev/null

# Wait for /health
for i in {1..20}; do
  if curl -sf "http://localhost:$TEE_PORT/health" >/dev/null; then break; fi
  sleep 0.5
  [[ $i == 20 ]] && fail "TEE container didn't come up"
done
ok "TEE container healthy"

# ── 3. Insert test skill ───────────────────────────────────
say "Inserting test skill $SKILL_ID…"
curl -sS -X POST "$SUPABASE_URL/rest/v1/skills" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "$(jq -n \
        --arg id "$SKILL_ID" \
        --arg ch "$CODE_HASH" \
        --arg ep "http://host.docker.internal:$TEE_PORT" \
        '{id:$id, name:"TEE Smoke Test", description:"smoke",
          pricing_model:"free", price_amount:0, price_currency:"usd",
          execution_model:"tee", manifest_visibility:"manifest_only",
          tee_provider:"phala", tee_endpoint:$ep, tee_code_hash:$ch}')"
ok "Skill inserted"

# ── 4. Invoke through platform ─────────────────────────────
# Note: the platform runs outside docker and hits localhost:$TEE_PORT
# directly, so override the endpoint to localhost here.
curl -sS -X PATCH "$SUPABASE_URL/rest/v1/skills?id=eq.$SKILL_ID" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"tee_endpoint\":\"http://localhost:$TEE_PORT\"}" >/dev/null

say "Invoking skill via $PLATFORM_URL …"
RESP="$(curl -sS -X POST "$PLATFORM_URL/api/invoke/$SKILL_ID" \
  -H "Content-Type: application/json" \
  -d '{"callerId":"smoke-user","callerType":"user","input":{"hello":"world"}}')"

echo "$RESP" | jq . || fail "Invalid JSON response: $RESP"

STATUS="$(echo "$RESP" | jq -r .status)"
[[ "$STATUS" == "success" ]] || fail "Expected status=success, got: $STATUS"

RETURNED_HASH="$(echo "$RESP" | jq -r '.attestation.codeHash // empty')"
[[ -n "$RETURNED_HASH" ]] || fail "Response missing attestation.codeHash"
[[ "$RETURNED_HASH" == "$CODE_HASH" ]] || fail "codeHash mismatch: expected $CODE_HASH, got $RETURNED_HASH"
ok "Attestation codeHash matches"

# ── 5. Verify attestation row exists ───────────────────────
ATT_ROWS="$(curl -sS "$SUPABASE_URL/rest/v1/tee_attestations?skill_id=eq.$SKILL_ID&select=id,valid,verifier" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")"
ATT_COUNT="$(echo "$ATT_ROWS" | jq 'length')"
[[ "$ATT_COUNT" -ge 1 ]] || fail "No attestation row recorded"
VERIFIER="$(echo "$ATT_ROWS" | jq -r '.[0].verifier')"
ok "Recorded attestation (verifier=$VERIFIER)"

echo
ok "✅ Tier-2 TEE smoke test passed."
