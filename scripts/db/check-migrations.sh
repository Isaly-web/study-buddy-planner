#!/usr/bin/env bash
# Post-merge drift check: every migration added by a push must be applied to the
# database. Each new supabase/migrations/<name>.sql needs supabase/checks/<name>.sql,
# a read-only query that returns one row with one boolean (true = applied).
#
# Usage: scripts/db/check-migrations.sh <base-sha> <head-sha>
# Env:   SUPABASE_CHECK_DATABASE_URL  connection string of a read-only role
set -euo pipefail

base="${1:?base sha required}"
head="${2:-HEAD}"

if [[ -z "${SUPABASE_CHECK_DATABASE_URL:-}" ]]; then
  echo "::error::SUPABASE_CHECK_DATABASE_URL is not set. Add it as a repository secret (read-only role)."
  exit 1
fi

if [[ ! "$SUPABASE_CHECK_DATABASE_URL" =~ ^postgres(ql)?:// ]]; then
  echo "::error::SUPABASE_CHECK_DATABASE_URL must be a full connection string starting with postgresql:// (user, password, pooler host, port and database)."
  exit 1
fi

# A new branch push has an all-zero base: compare against the parent instead.
if [[ "$base" =~ ^0+$ ]]; then
  base="$(git rev-parse "$head^" 2>/dev/null || git hash-object -t tree /dev/null)"
fi

mapfile -t added < <(git diff --name-only --diff-filter=A "$base" "$head" -- 'supabase/migrations/*.sql')

if [[ ${#added[@]} -eq 0 ]]; then
  echo "No new migrations in this push."
  exit 0
fi

failed=0
for migration in "${added[@]}"; do
  name="$(basename "$migration")"
  check="supabase/checks/$name"
  if [[ ! -f "$check" ]]; then
    echo "::error file=$migration::No check file. Add $check: a read-only query returning one boolean (true = applied)."
    failed=1
    continue
  fi
  if ! output="$(PGOPTIONS='-c default_transaction_read_only=on' \
    psql "$SUPABASE_CHECK_DATABASE_URL" -v ON_ERROR_STOP=1 -At -f "$check" 2>&1)"; then
    echo "::error file=$check::The check could not run (connection or SQL error): $output"
    failed=1
    continue
  fi
  result="$(echo "$output" | tail -n 1)"
  if [[ "$result" == "t" ]]; then
    echo "OK: $name is applied."
  else
    echo "::error file=$migration::NOT APPLIED (check returned '$result'). Apply this migration to the database."
    failed=1
  fi
done

exit "$failed"
