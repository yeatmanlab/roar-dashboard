#!/usr/bin/env bash
# Docker entrypoint-initdb.d script — runs once on first Postgres container creation.
#
# Creates the application databases (core + assessment) and the OpenFGA persistence
# database, then provisions the Foreign Data Wrapper (FDW) on the core database so it
# can read from the assessment database.
#
# Inside the container, FDW connects via Unix socket — no host-mapping complexity.

set -euo pipefail

echo "[init-dev-databases] Creating application and OpenFGA databases..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-SQL
  CREATE DATABASE roar_core_test;
  CREATE DATABASE roar_assessment_test;
  CREATE DATABASE roar_openfga;
SQL

echo "[init-dev-databases] Provisioning FDW on roar_core_test..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname roar_core_test <<-SQL
  CREATE EXTENSION IF NOT EXISTS postgres_fdw;

  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'assessment_server') THEN
      EXECUTE format(
        'CREATE SERVER assessment_server FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host %L, port %L, dbname %L)',
        '/var/run/postgresql', '5432', 'roar_assessment_test'
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

echo "[init-dev-databases] Done. Databases: roar_core_test, roar_assessment_test, roar_openfga"
