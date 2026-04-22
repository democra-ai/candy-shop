#!/usr/bin/env bash
# ============================================================
# Apply Supabase migrations via the Management API
# ============================================================
# Why this exists:
#   `supabase db push` tries IPv6 → login-role flow → silently
#   "succeeds" (prints "Applying migration...") without actually
#   running the SQL when either step fails. See commit history
#   for the diagnosis. This script bypasses all that by POSTing
#   each SQL file to the REST endpoint the dashboard itself uses.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_... \
#   SUPABASE_PROJECT_REF=xxxxxxxxxxx \
#   ./scripts/apply-migrations.sh
#
# Or pull token from the macOS Keychain (after `supabase login`):
#   SUPABASE_ACCESS_TOKEN=$(security find-generic-password -s "Supabase CLI" -w | base64 -d) \
#   SUPABASE_PROJECT_REF=$(cat supabase/.temp/project-ref) \
#   ./scripts/apply-migrations.sh
#
# Prints a summary at the end. Exits non-zero on any failure.
# ============================================================
set -euo pipefail

# shellcheck disable=SC2155
readonly MIG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase/migrations"

: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN (Personal Access Token, sbp_...)}"
: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF (e.g. from supabase/.temp/project-ref)}"

readonly API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query"
readonly UA="candy-shop-migrate/1.0"

run_sql() {
  # $1 = raw SQL string
  python3 -c "import json,sys;print(json.dumps({'query':sys.argv[1]}))" "$1" | \
    curl -sS --fail-with-body -X POST "$API" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -H "User-Agent: $UA" \
      --data-binary @-
}

run_sql_file() {
  # $1 = path to .sql file
  python3 -c "import json,sys;print(json.dumps({'query':open(sys.argv[1]).read()}))" "$1" | \
    curl -sS --fail-with-body -X POST "$API" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -H "User-Agent: $UA" \
      --data-binary @-
}

echo "→ Ensuring supabase_migrations.schema_migrations exists"
run_sql "CREATE SCHEMA IF NOT EXISTS supabase_migrations;
         CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
           version text NOT NULL PRIMARY KEY,
           name    text,
           statements text[]
         );" >/dev/null
echo

applied=()
skipped=()
failed=()

# Migration files sort lexicographically (001_x.sql, 002_y.sql, ...)
for sql_file in "$MIG_DIR"/*.sql; do
  fname=$(basename "$sql_file")                          # 001_init.sql
  version="${fname%%_*}"                                  # 001
  name="${fname#*_}"; name="${name%.sql}"                 # init

  # Skip if already recorded
  exists=$(run_sql "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${version}' LIMIT 1")
  if [[ "$exists" == *'"?column?":1'* ]]; then
    echo "  ⏭  $fname (already applied)"
    skipped+=("$version")
    continue
  fi

  echo "→ Applying $fname"
  if run_sql_file "$sql_file" >/dev/null; then
    run_sql "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${version}', '${name}') ON CONFLICT (version) DO NOTHING" >/dev/null
    echo "  ✓ $fname"
    applied+=("$version")
  else
    echo "  ✗ $fname FAILED"
    failed+=("$version")
    break
  fi
done

# Refresh PostgREST cache so REST endpoints see new tables immediately
if [[ ${#applied[@]} -gt 0 ]]; then
  echo
  echo "→ Reloading PostgREST schema cache"
  run_sql "NOTIFY pgrst, 'reload schema'" >/dev/null
fi

echo
echo "── Summary ──"
echo "  applied: ${#applied[@]} (${applied[*]:-none})"
echo "  skipped: ${#skipped[@]} (${skipped[*]:-none})"
echo "  failed:  ${#failed[@]} (${failed[*]:-none})"

[[ ${#failed[@]} -eq 0 ]]
