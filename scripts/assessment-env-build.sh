#!/usr/bin/env bash
# assessment-env-build.sh — Force a no-cache rebuild of the assessment Docker images.
#
# Called from an assessment package's `rebuild` script.
# Use this when changes to the Dockerfile or build context are not picked up
# due to Docker layer caching.
#
# Usage (from any assessment package.json):
#   "rebuild": "bash ../../../scripts/assessment-env-build.sh"
set -euo pipefail

# Shared context (REPO_ROOT, COMPOSE_FILE) and pre-flight checks. See assessment-common.sh.
source "$(cd "$(dirname "$0")" && pwd)/assessment-common.sh"

if ! docker_compose_available; then
  echo "Error: Docker with Compose v2 is required." >&2
  print_docker_install_help
  exit 1
fi

echo "Rebuilding assessment Docker images (no cache)..."
docker compose -f "$COMPOSE_FILE" build --no-cache
echo "Rebuild complete."
