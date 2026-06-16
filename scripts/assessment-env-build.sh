#!/usr/bin/env bash
# assessment-env-build.sh — Force a no-cache rebuild of the assessment Docker images.
#
# Called from an assessment package's assessment-env:build script.
# Use this when changes to the Dockerfile or build context are not picked up
# due to Docker layer caching.
#
# Usage (from any assessment package.json):
#   "assessment-environment:build": "bash ../../../scripts/assessment-env-build.sh"
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.assessment.yml"

if ! docker compose version &>/dev/null; then
  echo "Error: 'docker compose' (v2) is required. Install Docker Desktop or Docker Engine with the Compose plugin." >&2
  exit 1
fi

echo "Rebuilding assessment Docker images (no cache)..."
docker compose -f "$COMPOSE_FILE" build --no-cache
echo "Rebuild complete."
