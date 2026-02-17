#!/usr/bin/env bash
set -euo pipefail

PSQL="/opt/homebrew/opt/postgresql@16/bin/psql"
DB="${1:-roar_core}"
PORT="${2:-5432}"

echo "Disabling triggers for database: $DB"

$PSQL -p "$PORT" -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'app'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER ALL;', r.schemaname, r.tablename);
    RAISE NOTICE 'Disabled triggers for %.%', r.schemaname, r.tablename;
  END LOOP;
END $$;
SQL

echo "All triggers disabled for $DB"
