#!/usr/bin/env bash
# assessment-env-down.sh — Stop the shared assessment infrastructure and
# remove all associated volumes.
#
# Called from an assessment package's `stop` script.
# Falls back to direct process kills when the Docker API can't stop containers.
# On some Linux systems, AppArmor blocks 'docker stop'/'docker kill' with
# "permission denied"; in that case the script prints the 'sudo kill' command
# to run manually.
#
# The teardown deletes the database volume (all local data), so it prompts for
# confirmation when run interactively. Skip with -y/--yes, or on a non-TTY (CI,
# pipes), where it proceeds without asking.
#
# Usage (from any assessment package.json):
#   "stop": "bash ../../../scripts/assessment-env-down.sh"
set -uo pipefail

# Shared context (REPO_ROOT, COMPOSE_FILE). See assessment-common.sh.
source "$(cd "$(dirname "$0")" && pwd)/assessment-common.sh"

CONTAINERS=(assessment-backend assessment-db-migrate firebase-emulator assessment-db)

# Confirm before the irreversible teardown (deletes the DB volume, losing every
# run/trial/score/recording). Declining is a valid choice, not an error, so exit 0
# — a non-zero exit would make npm print a misleading "lifecycle script failed"
# wrapper. `restart` runs its own confirm and calls this with --yes, so this prompt
# fires only for a bare `stop`. See confirm_teardown in assessment-common.sh.
if ! confirm_teardown "$@"; then
  echo "Aborted — the local database was left intact." >&2
  exit 0
fi

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
