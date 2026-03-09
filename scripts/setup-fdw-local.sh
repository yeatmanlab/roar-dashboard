#!/usr/bin/env bash
# setup-fdw-local.sh — Provision postgres_fdw prerequisites for local development
#
# Run BEFORE Drizzle migrations. Handles superuser-only operations that Drizzle
# cannot perform: extension, server, user mapping, and the app_fdw schema.
# Views (assessment) and foreign tables (core) come from Drizzle migrations.
#
# Prerequisites: both core and assessment databases exist locally
# Usage: ./scripts/setup-fdw-local.sh

set -euo pipefail

CORE_DB="${CORE_DB:-core}"
ASSESSMENT_DB="${ASSESSMENT_DB:-assessment}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-postgres}"

# Assessment side: create app_fdw schema (views come from Drizzle migrations)
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$ASSESSMENT_DB" <<'SQL'
CREATE SCHEMA IF NOT EXISTS app_fdw;
SQL

# Core side: extension, server, user mapping (foreign tables come from Drizzle migrations)
# Creates the server if missing, or updates connection options if it already exists.
# DROP CASCADE is avoided because it would destroy foreign tables that Drizzle migrations
# won't recreate.
psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$CORE_DB" <<SQL
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DO \$\$
DECLARE
  _host constant text := '$PG_HOST';
  _port constant text := '$PG_PORT';
  _dbname constant text := '$ASSESSMENT_DB';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'assessment_server') THEN
    EXECUTE format(
      'CREATE SERVER assessment_server FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host %L, port %L, dbname %L)',
      _host, _port, _dbname
    );
  ELSE
    EXECUTE format(
      'ALTER SERVER assessment_server OPTIONS (SET host %L, SET port %L, SET dbname %L)',
      _host, _port, _dbname
    );
  END IF;
END
\$\$;

-- Upsert helper: creates or replaces a user mapping for the given role.
CREATE OR REPLACE FUNCTION pg_temp.upsert_user_mapping(_role text, _options text)
RETURNS void LANGUAGE plpgsql AS \$func\$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_user_mappings
    WHERE srvname = 'assessment_server' AND usename = _role
  ) THEN
    EXECUTE format('DROP USER MAPPING FOR %I SERVER assessment_server', _role);
  END IF;
  EXECUTE format('CREATE USER MAPPING FOR %I SERVER assessment_server OPTIONS (%s)', _role, _options);
END
\$func\$;

DO \$\$
DECLARE
  _pg_user constant text := '$PG_USER';
  _password constant text := '${PGPASSWORD:-}';
  _options text;
BEGIN
  _options := format('user %L', _pg_user);

  -- Include password in mapping options when PGPASSWORD is set (CI/password-auth environments).
  -- Omitted for local-dev trust-auth setups where no password is needed.
  IF _password <> '' THEN
    _options := _options || format(', password %L', _password);
  END IF;

  -- Always create a mapping for PG_USER (the explicit connection user).
  PERFORM pg_temp.upsert_user_mapping(_pg_user, _options);

  -- Also map CURRENT_USER when it differs from PG_USER (e.g., local dev where
  -- the OS user connects via peer/trust auth but PG_USER defaults to postgres).
  IF current_user <> _pg_user THEN
    PERFORM pg_temp.upsert_user_mapping(current_user, _options);
  END IF;
END
\$\$;
SQL

echo "FDW prerequisites provisioned. Now run Drizzle migrations:"
echo "  1. Assessment DB: drizzle-kit migrate (creates app_fdw.fdw_runs, app_fdw.fdw_run_scores views)"
echo "  2. Core DB: drizzle-kit migrate (creates app_assessment_fdw schema + foreign tables)"
echo ""
echo "Then test with:"
echo "  psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $CORE_DB -c 'SELECT * FROM app_assessment_fdw.runs LIMIT 5;'"
