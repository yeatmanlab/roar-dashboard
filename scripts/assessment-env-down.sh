#!/usr/bin/env bash
# assessment-env-down.sh — Stop the shared assessment infrastructure and
# remove all associated volumes.
#
# Called from an assessment package's assessment-environment:down script.
# Falls back to direct process kills when the Docker API can't stop containers.
# On some Linux systems, AppArmor blocks 'docker stop'/'docker kill' with
# "permission denied"; in that case the script prints the 'sudo kill' command
# to run manually.
#
# Usage (from any assessment package.json):
#   "assessment-environment:down": "bash ../../../scripts/assessment-env-down.sh"
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.assessment.yml"

CONTAINERS=(assessment-backend assessment-db-migrate firebase-auth-emulator assessment-db)

echo "Stopping assessment environment..."

# --timeout 0 sends SIGKILL immediately instead of waiting for graceful shutdown.
if docker compose -f "$COMPOSE_FILE" down -v --remove-orphans --timeout 0 2>/dev/null; then
  echo "Assessment environment stopped."
  exit 0
fi

echo "Warning: docker compose down failed. Falling back to direct process termination..." >&2

# Disable restart policies before killing so Docker doesn't revive containers
# after the first kill (restart: unless-stopped would otherwise bring them back).
for container in "${CONTAINERS[@]}"; do
  docker update --restart=no "$container" 2>/dev/null || true
done

failed_pids=()
for container in "${CONTAINERS[@]}"; do
  pid=$(docker inspect --format '{{.State.Pid}}' "$container" 2>/dev/null || true)
  if [[ -n "$pid" && "$pid" -gt 0 ]]; then
    if kill -9 "$pid" 2>/dev/null; then
      echo "  Killed $container (pid $pid)"
    else
      echo "  Warning: could not kill $container (pid $pid)" >&2
      failed_pids+=("$pid")
    fi
  fi
done

if [[ ${#failed_pids[@]} -gt 0 ]]; then
  echo "" >&2
  echo "Some containers could not be stopped (Linux AppArmor restriction)." >&2
  echo "Run the following, then retry:" >&2
  echo "  sudo kill -9 ${failed_pids[*]}" >&2
  exit 1
fi

# Give Docker a moment to notice the processes are gone, then clean up.
sleep 1
docker compose -f "$COMPOSE_FILE" down -v --remove-orphans --timeout 0 2>/dev/null || true
docker rm -f "${CONTAINERS[@]}" 2>/dev/null || true
docker volume rm roar-assessment_pgdata 2>/dev/null || true

echo "Assessment environment stopped."
