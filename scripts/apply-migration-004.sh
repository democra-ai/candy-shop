#!/usr/bin/env bash
# ============================================================
# Apply migration 004_tee_execution.sql to remote Supabase
# ============================================================
# Uses the Supabase Management API (no DB password needed) when a PAT is
# available. Falls back to `supabase db push` (prompts for DB password).
#
# PAT resolution order:
#   1. $SUPABASE_ACCESS_TOKEN (env)
#   2. macOS keychain entry: service="Supabase CLI" account="supabase"
#      (stored by `supabase login`; go-keyring-base64: prefix is decoded)
# ============================================================

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

for f in .env server/.env .env.local; do
  [[ -f "$f" ]] && { set -a; source "$f"; set +a; }
done

: "${SUPABASE_PROJECT_REF:=ygecdbbtzbsoimuljyoc}"
MIGRATION_FILE="supabase/migrations/004_tee_execution.sql"
[[ -f "$MIGRATION_FILE" ]] || { echo "Missing $MIGRATION_FILE" >&2; exit 1; }

# ── Resolve PAT ────────────────────────────────────────────
PAT="${SUPABASE_ACCESS_TOKEN:-}"
if [[ -z "$PAT" ]]; then
  raw=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w 2>/dev/null || true)
  if [[ -n "$raw" ]]; then
    if [[ "$raw" == go-keyring-base64:* ]]; then
      PAT=$(echo "${raw#go-keyring-base64:}" | base64 -d)
    else
      PAT="$raw"
    fi
  fi
fi

# ── Preferred path: Management API ─────────────────────────
if [[ -n "$PAT" ]]; then
  command -v jq >/dev/null || { echo "jq required"; exit 1; }
  echo "[migration] Using Supabase Management API (PAT)…"
  SQL=$(cat "$MIGRATION_FILE")
  BODY=$(jq -nc --arg q "$SQL" '{query:$q}')
  RESP=$(curl -sS -w '\n%{http_code}' \
    "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
    -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" -d "$BODY")
  CODE="${RESP##*$'\n'}"
  BODYRESP="${RESP%$'\n'*}"
  if [[ "$CODE" =~ ^2[0-9][0-9]$ ]]; then
    echo "[migration] ✅ applied (HTTP $CODE)"
    exit 0
  else
    echo "[migration] Management API returned HTTP $CODE" >&2
    echo "$BODYRESP" >&2
    echo "[migration] Falling back to supabase db push…"
  fi
fi

# ── Fallback: supabase db push (DB password) ───────────────
if ! command -v supabase >/dev/null; then
  echo "supabase CLI not found. Install: brew install supabase/tap/supabase" >&2
  exit 1
fi
if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "[migration] Need DB password (Settings → Database)."
  read -rs -p "Password: " SUPABASE_DB_PASSWORD
  echo
  export SUPABASE_DB_PASSWORD
fi
supabase db push --include-all
