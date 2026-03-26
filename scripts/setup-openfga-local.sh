#!/usr/bin/env bash
# setup-openfga-local.sh — Create the openfga Postgres database for local development
#
# OpenFGA uses Postgres as its tuple store. This script creates the database if it
# doesn't already exist. Run once before `docker compose up`.
#
# OpenFGA's internal schema migrations are handled by the openfga-migrate service
# in docker-compose.yml — you don't need to run them manually.
#
# Usage: ./scripts/setup-openfga-local.sh

set -euo pipefail

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-postgres}"
OPENFGA_DB="${OPENFGA_DB:-roar_openfga}"
# Connect via roar_core since the default 'postgres' database may not exist locally.
CONNECT_DB="${CONNECT_DB:-roar_core}"

# Validate database name to prevent SQL injection (alphanumeric and underscores only)
if [[ ! "$OPENFGA_DB" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "Error: Invalid database name '$OPENFGA_DB'. Use only alphanumeric characters and underscores." >&2
  exit 1
fi

echo "Creating database '$OPENFGA_DB' on $PG_HOST:$PG_PORT..."

psql -v ON_ERROR_STOP=1 -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$CONNECT_DB" \
  -c "CREATE DATABASE $OPENFGA_DB" 2>/dev/null || echo "Database '$OPENFGA_DB' already exists, skipping."

echo "Done. You can now run: docker compose up"
