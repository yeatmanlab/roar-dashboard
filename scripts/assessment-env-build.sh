#!/usr/bin/env bash
# assessment-env-build.sh — Rebuild the assessment Docker images and, when the
# stack is running, apply them.
#
# Called from an assessment package's `rebuild` script. The build is cached —
# routine post-pull rebuilds take seconds. Pass --no-cache for the rare case
# where a cached layer is wrong (e.g. a registry package republished under the
# same version):
#   npm run rebuild -- --no-cache
#
# Usage (from any assessment package.json):
#   "rebuild": "bash ../../../scripts/assessment-env-build.sh"
set -euo pipefail

# Shared context (REPO_ROOT, COMPOSE_FILE) and pre-flight checks. See assessment-common.sh.
source "$(cd "$(dirname "$0")" && pwd)/assessment-common.sh"

# Exported so docker compose can substitute ${ASSESSMENT_NAME} in the compose file.
export ASSESSMENT_NAME

if ! docker_compose_available; then
  echo "Error: Docker with Compose v2 is required." >&2
  print_docker_install_help
  exit 1
fi
if ! docker_daemon_running; then
  echo "Error: Docker is installed but not running." >&2
  print_docker_daemon_help
  exit 1
fi

BUILD_ARGS=()
if [[ " $* " == *" --no-cache "* ]]; then
  BUILD_ARGS+=(--no-cache)
  echo "Rebuilding assessment Docker images (no cache)..."
else
  echo "Rebuilding assessment Docker images..."
fi
docker compose -f "$COMPOSE_FILE" build "${BUILD_ARGS[@]}"

# Fresh images do nothing while old containers keep running — `npm start` takes
# its already-running fast path and never recreates them. Apply the images now:
# compose recreates only services whose image changed and the database volume
# survives. The emulator container restarting does clear its in-memory auth
# users and recordings (this stack does not persist emulator state).
if assessment_container_running assessment-backend; then
  echo "Applying the new images to the running stack (database data survives;"
  echo "emulator auth users/recordings are in-memory and reset)..."
  docker compose -f "$COMPOSE_FILE" up -d --wait
fi

echo "Rebuild complete."
