#!/usr/bin/env bash
# researcher-env-up.sh — Start the shared researcher infrastructure and the
# assessment dev server.
#
# Called from an assessment package's researcher-environment:up script.
# Starts the shared Docker stack (DB, migrations, Firebase emulator, backend)
# then runs `npm run dev` in the assessment directory that invoked this script.
#
# Usage (from any assessment package.json):
#   "researcher-environment:up": "bash ../../../scripts/researcher-env-up.sh"
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSESSMENT_DIR="$(pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.researcher.yml"

if ! docker compose version &>/dev/null; then
  echo "Error: 'docker compose' (v2) is required. Install Docker Desktop or Docker Engine with the Compose plugin." >&2
  exit 1
fi

# Check that port 5432 is free before Docker tries to bind it (the error Docker
# produces when the port is taken is cryptic).
if lsof -i :5432 -sTCP:LISTEN &>/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ':5432 '; then
  echo "Error: port 5432 is already in use." >&2
  echo "  Stop your local PostgreSQL instance before starting the researcher environment:" >&2
  echo "    macOS (Homebrew): brew services stop postgresql@<version>" >&2
  echo "    Ubuntu/Debian:    sudo systemctl stop postgresql" >&2
  echo "    Docker container: docker ps | grep 5432" >&2
  exit 1
fi

echo "Starting researcher environment (DB, migrations, Firebase emulator, backend)..."

# Remove any orphaned containers from a previous run under a different compose project.
docker rm -f researcher-db researcher-db-migrate 2>/dev/null || true

docker compose -f "$COMPOSE_FILE" up -d --wait

echo "All services healthy. Starting assessment dev server..."
cd "$ASSESSMENT_DIR"
exec env \
  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  BACKEND_URL=http://localhost:4000 \
  npm run dev:server
