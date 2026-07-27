#!/usr/bin/env bash
# Docker entrypoint-initdb.d script — runs once on first Postgres container creation.
#
# Creates four application databases (dev + test for both core and assessment),
# the OpenFGA persistence database, and provisions the Foreign Data Wrapper (FDW)
# on both core databases so they can read from their respective assessment databases.
#
# Inside the container, FDW connects via Unix socket — no host-mapping complexity.

set -euo pipefail

echo "[init-dev-databases] Creating application and OpenFGA databases..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-SQL
  -- Dev databases (used by npm run dev)
  CREATE DATABASE roar_core;
  CREATE DATABASE roar_assessment;
  -- Test databases (used by npm run test:integration)
  CREATE DATABASE roar_core_test;
  CREATE DATABASE roar_assessment_test;
  -- OpenFGA persistence database
  CREATE DATABASE roar_openfga;
SQL

# Provision FDW on a core database, pointing at its paired assessment database.
# $1 = core database name, $2 = assessment database name
provision_fdw() {
  local core_db="$1"
  local assessment_db="$2"

  echo "[init-dev-databases] Provisioning FDW on ${core_db} -> ${assessment_db}..."
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$core_db" <<-SQL
    CREATE EXTENSION IF NOT EXISTS postgres_fdw;

    DO \$\$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'assessment_server') THEN
        EXECUTE format(
          'CREATE SERVER assessment_server FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host %L, port %L, dbname %L)',
          '/var/run/postgresql', '5432', '${assessment_db}'
        );
      END IF;
    END
    \$\$;

    DO \$\$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_user_mappings WHERE srvname = 'assessment_server' AND usename = '$POSTGRES_USER'
      ) THEN
        EXECUTE format('CREATE USER MAPPING FOR %I SERVER assessment_server OPTIONS (user %L)',
          '$POSTGRES_USER', '$POSTGRES_USER');
      END IF;
    END
    \$\$;
SQL
}

provision_fdw "roar_core" "roar_assessment"
provision_fdw "roar_core_test" "roar_assessment_test"

echo "[init-dev-databases] Done. Databases: roar_core, roar_assessment, roar_core_test, roar_assessment_test, roar_openfga"
