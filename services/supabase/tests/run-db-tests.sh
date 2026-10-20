#!/usr/bin/env bash
# Applies every migration to a fresh Postgres and runs the SQL test files.
# Uses $DATABASE_URL if set (CI service container); otherwise starts a
# throwaway local cluster with the Postgres binaries on PATH.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
migrations="$here/../migrations"

cleanup() { :; }
if [[ -z "${DATABASE_URL:-}" ]]; then
  bindir="$(pg_config --bindir 2>/dev/null || ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
  tmp="$(mktemp -d)"
  "$bindir/initdb" -D "$tmp/data" -U postgres --auth=trust >/dev/null
  "$bindir/pg_ctl" -D "$tmp/data" -o "-p 55432 -k $tmp -c listen_addresses=''" -l "$tmp/log" -w start >/dev/null
  cleanup() { "$bindir/pg_ctl" -D "$tmp/data" -m fast stop >/dev/null || true; rm -rf "$tmp"; }
  export DATABASE_URL="postgresql://postgres@/postgres?host=$tmp&port=55432"
  if [[ "$(id -u)" == 0 ]]; then
    echo "run-db-tests: refusing to run Postgres as root; set DATABASE_URL" >&2
    exit 2
  fi
fi
trap cleanup EXIT

psql_() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X "$@"; }
psql_ -f "$here/sql/00_supabase_shim.sql"
for f in "$migrations"/*.sql; do
  echo "migrate: $(basename "$f")"
  psql_ -f "$f"
done
psql_ -f "$here/sql/01_grants_service_role.sql"
for t in "$here"/sql/*.test.sql; do
  echo "test: $(basename "$t")"
  psql_ -f "$t" >/dev/null
  echo "  passed ($(grep -cE 'expect_(denied|rows|violation)\(' "$t") assertions)"
done
