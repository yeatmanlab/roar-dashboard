#!/usr/bin/env bash
# assessment-env-up.sh — Start the shared assessment infrastructure and the
# assessment dev server.
#
# Called from an assessment package's `start` script.
# Starts the shared Docker stack (DB, migrations, Firebase emulators, backend)
# then runs the dev server in the assessment directory that invoked this script.
#
# Its pre-flight checks are hard gates (unlike `npm run setup`, whose equivalent
# checks are advisory): `setup` is optional, so this script cannot assume it ran
# and must fail safe on its own.
#
# Usage (from any assessment package.json):
#   "start": "bash ../../../scripts/assessment-env-up.sh"
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
# only starts after migrations and the Firebase emulators are healthy. This covers
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

  # Force-remove stale containers by name before starting. These linger from a
  # previous run and cause name or port conflicts — including containers left
  # under an older compose project name (docker rm by name ignores project
  # scoping, unlike --remove-orphans) and the retired "firebase-auth-emulator"
  # container name from older checkouts. Runs before the port preflight so
  # leftovers from a previous assessment run self-heal instead of erroring.
  docker rm -f \
    assessment-db \
    assessment-db-migrate \
    firebase-auth-emulator \
    firebase-emulator \
    assessment-backend \
    2>/dev/null || true

  # Check every port the stack binds (STACK_PORTS) before Docker tries to — the
  # error Docker produces when a port is taken is cryptic, and the fix differs
  # by culprit.
  for port in "${STACK_PORTS[@]}"; do
    if port_in_use "$port"; then
      echo "Error: port ${port} is already in use." >&2
      diagnose_port_conflict "$port"
      exit 1
    fi
  done

  echo "Starting assessment environment (DB, migrations, Firebase emulators, backend)..."

  # --remove-orphans drops any container in the roar-assessment project whose
  # service no longer exists, so future service renames self-heal without
  # needing to be listed above.
  docker compose -f "$COMPOSE_FILE" up -d --wait --remove-orphans

  echo "All services healthy. Starting assessment dev server..."
fi
cd "$ASSESSMENT_DIR"

# Vite-based assessments (e.g. roar-survey) have no webpack.config.cjs.
# Use vite for those; webpack for everything else.
# FIREBASE_AUTH_EMULATOR_HOST needs no explicit value — dev-mode bundler configs
# default it to the local emulator. BACKEND_URL points the /v1 proxy at the
# containerized backend (plain HTTP) instead of the host-run TLS default.
if [[ -f "$ASSESSMENT_DIR/webpack.config.cjs" ]]; then
  exec env \
    BACKEND_URL=http://localhost:4000 \
    npx webpack serve --open --mode development --env dbmode=development
else
  exec env \
    BACKEND_URL=http://localhost:4000 \
    npx vite --mode development
fi
