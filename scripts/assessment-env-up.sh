#!/usr/bin/env bash
# assessment-env-up.sh — Start the shared assessment infrastructure and the
# assessment dev server.
#
# Called from an assessment package's assessment-environment:up script.
# Starts the shared Docker stack (DB, migrations, Firebase emulator, backend)
# then runs the assessment dev server in the directory that invoked this script.
#
# Its pre-flight checks are hard gates (unlike `npm run setup`, whose equivalent
# checks are advisory): `init` is optional, so this script cannot assume it ran
# and must fail safe on its own.
#
# Usage (from any assessment package.json):
#   "assessment-environment:up": "bash ../../../scripts/assessment-env-up.sh"
set -euo pipefail

# Shared context (REPO_ROOT, COMPOSE_FILE, ASSESSMENT_DIR, ASSESSMENT_NAME,
# PARAMS_FILE) and pre-flight checks. See assessment-common.sh.
source "$(cd "$(dirname "$0")" && pwd)/assessment-common.sh"

# Exported so docker compose can substitute ${ASSESSMENT_NAME} in the compose file.
export ASSESSMENT_NAME

if ! docker_compose_available; then
  echo "Error: Docker with Compose v2 is required." >&2
  print_docker_install_help
  exit 1
fi

# If the backend container is already running the full stack is up — the backend
# only starts after migrations and the Firebase emulator are healthy. This covers
# the common case where the user killed the dev server with Ctrl+C but left the
# Docker stack running. Skip straight to restarting the dev server.
if assessment_container_running assessment-backend; then
  echo "Assessment environment already running. Starting assessment dev server..."
else
  # Require the config file before Docker tries to seed from it.
  if [ ! -f "$PARAMS_FILE" ]; then
    print_params_file_missing_help
    exit 1
  fi

  # Check the host port before Docker tries to bind it (the error Docker produces
  # when the port is taken is cryptic).
  if port_in_use "$ASSESSMENT_PG_PORT"; then
    echo "Error: port $ASSESSMENT_PG_PORT is already in use." >&2
    print_port_in_use_help
    exit 1
  fi

  echo "Starting assessment environment (DB, migrations, Firebase emulator, backend)..."

  # Force-remove stale containers by name before starting. These linger from a
  # previous run and cause name or port conflicts — including containers left
  # under an older compose project name (docker rm by name ignores project
  # scoping, unlike --remove-orphans) and the since-renamed "firebase-emulator"
  # service (now "firebase-auth-emulator"), whose old container still publishes
  # 9000/9099/9199 and blocks the new emulator from binding them.
  docker rm -f \
    assessment-db \
    assessment-db-migrate \
    firebase-auth-emulator \
    firebase-emulator \
    assessment-backend \
    2>/dev/null || true

  # --remove-orphans drops any container in the roar-assessment project whose
  # service no longer exists, so future service renames self-heal without
  # needing to be listed above.
  docker compose -f "$COMPOSE_FILE" up -d --wait --remove-orphans

  echo "All services healthy. Starting assessment dev server..."
fi
cd "$ASSESSMENT_DIR"

# Vite-based assessments (e.g. roar-survey) have no webpack.config.cjs.
# Use vite for those; webpack for everything else.
if [[ -f "$ASSESSMENT_DIR/webpack.config.cjs" ]]; then
  exec env \
    FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
    BACKEND_URL=http://localhost:4000 \
    npx webpack serve --open --mode development --env dbmode=development
else
  exec env \
    FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
    BACKEND_URL=http://localhost:4000 \
    npx vite --mode development
fi
