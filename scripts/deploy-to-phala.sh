#!/usr/bin/env bash
# ============================================================
# Deploy a Tier-2 skill to Phala Cloud
# ============================================================
# End-to-end: build → push → phala deploy → update Supabase row.
#
# Usage:
#   SKILL_ID=<uuid> SKILL_IMAGE=<registry>/<image>:<tag> \
#     ./scripts/deploy-to-phala.sh
#
# Requires (in order):
#   - Phala API key   ($PHALA_API_KEY, or `phala login` done beforehand)
#   - Docker + a push target you're authenticated to (GHCR / Docker Hub)
#   - Supabase PAT    (auto-read from keychain; see apply-migration-004.sh)
#
# The script:
#   1. Builds ./tee-template with your skill.json baked in
#   2. Pushes the image to $SKILL_IMAGE (skip with --skip-push if pre-pushed)
#   3. Calls `phala deploy` with the compose manifest
#   4. Reads back the CVM endpoint and code hash
#   5. UPDATE skills SET tee_endpoint=..., tee_code_hash=... WHERE id=$SKILL_ID
# ============================================================

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

: "${SKILL_ID:?SKILL_ID env var required (must exist in skills table)}"
: "${SKILL_IMAGE:?SKILL_IMAGE env var required (e.g. ghcr.io/you/skill-$SKILL_ID:v1)}"
: "${SUPABASE_PROJECT_REF:=ygecdbbtzbsoimuljyoc}"

SKIP_PUSH=0
while [[ $# -gt 0 ]]; do
  case "$1" in --skip-push) SKIP_PUSH=1; shift;; *) shift;; esac
done

# ── 0. Prereqs ─────────────────────────────────────────────
for cmd in docker phala jq curl security base64; do
  command -v "$cmd" >/dev/null || { echo "Missing $cmd"; exit 1; }
done
[[ -f tee-template/skill.json ]] || { echo "Create tee-template/skill.json first (cp skill.example.json skill.json)"; exit 1; }

# ── 1. Build ───────────────────────────────────────────────
echo "[deploy] Building image $SKILL_IMAGE"
docker build -t "$SKILL_IMAGE" tee-template/
CODE_HASH="$(docker run --rm "$SKILL_IMAGE" cat /app/code_hash.txt | tr -d '[:space:]')"
echo "[deploy] code_hash=$CODE_HASH"

# ── 2. Push ────────────────────────────────────────────────
if [[ $SKIP_PUSH -eq 0 ]]; then
  echo "[deploy] Pushing to registry"
  docker push "$SKILL_IMAGE"
else
  echo "[deploy] --skip-push set, assuming image already in registry"
fi

# ── 3. Phala deploy ────────────────────────────────────────
if [[ -n "${PHALA_API_KEY:-}" ]]; then
  phala login --api-key "$PHALA_API_KEY"
fi
phala status >/dev/null 2>&1 || { echo "Not authenticated. Run: phala login"; exit 1; }

echo "[deploy] Creating CVM via phala deploy…"
SKILL_IMAGE="$SKILL_IMAGE" phala deploy \
  --compose tee-template/docker-compose.yml \
  --name "candy-skill-${SKILL_ID:0:8}" \
  --wait --json > /tmp/phala-deploy.json

ENDPOINT="$(jq -r '.endpoint // .app_url // .url // empty' /tmp/phala-deploy.json)"
CVM_ID="$(jq -r '.id // .app_id // empty' /tmp/phala-deploy.json)"
if [[ -z "$ENDPOINT" ]]; then
  echo "[deploy] phala deploy response did not include endpoint:"
  cat /tmp/phala-deploy.json >&2
  exit 1
fi
echo "[deploy] CVM live: $ENDPOINT"

# ── 4. Update Supabase row ─────────────────────────────────
PAT="${SUPABASE_ACCESS_TOKEN:-}"
if [[ -z "$PAT" ]]; then
  raw=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w 2>/dev/null || true)
  if [[ "$raw" == go-keyring-base64:* ]]; then PAT=$(echo "${raw#go-keyring-base64:}" | base64 -d);
  else PAT="$raw"; fi
fi

if [[ -z "$PAT" ]]; then
  cat <<EOF
[deploy] No Supabase PAT found. Run this SQL manually:
UPDATE public.skills SET
  tee_endpoint = '$ENDPOINT',
  tee_code_hash = '$CODE_HASH',
  tee_provider = 'phala',
  tee_attestation_url = '$ENDPOINT/attestation'
WHERE id = '$SKILL_ID';
EOF
  exit 0
fi

SQL="update public.skills set tee_endpoint='$ENDPOINT', tee_code_hash='$CODE_HASH', tee_provider='phala', tee_attestation_url='$ENDPOINT/attestation', execution_model='tee' where id='$SKILL_ID' returning id;"
curl -sS "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d "$(jq -nc --arg q "$SQL" '{query:$q}')" | jq .

echo "[deploy] ✅ Skill $SKILL_ID is now live in TEE at $ENDPOINT"
[[ -n "$CVM_ID" ]] && echo "[deploy]    CVM id: $CVM_ID"
