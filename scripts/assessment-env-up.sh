#!/usr/bin/env bash
# assessment-env-up.sh — Start the shared assessment infrastructure and the
# assessment dev server.
#
# Called from an assessment package's assessment-environment:up script.
# Starts the shared Docker stack (DB, migrations, Firebase emulator, backend)
# then runs `npm run dev` in the assessment directory that invoked this script.
#
# Usage (from any assessment package.json):
#   "assessment-environment:up": "bash ../../../scripts/assessment-env-up.sh"
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSESSMENT_DIR="$(pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.assessment.yml"

# Derive assessment name from the calling directory (e.g. roar-pa → roar-pa).
# Exported so docker compose can substitute ${ASSESSMENT_NAME} in the compose file.
ASSESSMENT_NAME="$(basename "$ASSESSMENT_DIR")"
export ASSESSMENT_NAME

if ! docker compose version &>/dev/null; then
  echo "Error: 'docker compose' (v2) is required. Install Docker Desktop or Docker Engine with the Compose plugin." >&2
  exit 1
fi

# If the backend container is already running the full stack is up — the backend
# only starts after migrations and the Firebase emulator are healthy. This covers
# the common case where the user killed the webpack dev server with Ctrl+C but
# left the Docker stack running. Skip straight to restarting the dev server.
if docker ps --filter "name=assessment-backend" --filter "status=running" -q 2>/dev/null | grep -q .; then
  echo "Assessment environment already running. Starting assessment dev server..."
else
  # Check that port 5432 is free before Docker tries to bind it (the error Docker
  # produces when the port is taken is cryptic).
  if [ ! -f "$ASSESSMENT_DIR/taskVariantParameters.json" ]; then
    echo "Error: taskVariantParameters.json not found in $ASSESSMENT_DIR." >&2
    echo "  Create it from the example file before starting:" >&2
    echo "    cp apps/assessments/$ASSESSMENT_NAME/taskVariantParameters.example.json \\" >&2
    echo "       apps/assessments/$ASSESSMENT_NAME/taskVariantParameters.json" >&2
    exit 1
  fi

  if lsof -i :5432 -sTCP:LISTEN &>/dev/null || ss -tlnp 2>/dev/null | grep -q ':5432 '; then
    echo "Error: port 5432 is already in use." >&2
    echo "  Stop your local PostgreSQL instance before starting the assessment environment:" >&2
    echo "    macOS (Homebrew): brew services stop postgresql@<version>" >&2
    echo "    Ubuntu/Debian:    sudo systemctl stop postgresql" >&2
    echo "    Docker container: docker ps | grep 5432" >&2
    exit 1
  fi

  echo "Starting assessment environment (DB, migrations, Firebase emulator, backend)..."

  # Remove any orphaned containers from a previous run under a different compose project.
  docker rm -f assessment-db assessment-db-migrate 2>/dev/null || true

  docker compose -f "$COMPOSE_FILE" up -d --wait

  echo "All services healthy. Starting assessment dev server..."
fi
cd "$ASSESSMENT_DIR"
exec env \
  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  BACKEND_URL=http://localhost:4000 \
  npx webpack serve --open --mode development --env dbmode=development
