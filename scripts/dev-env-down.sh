#!/usr/bin/env bash
# dev-env-down.sh — Tear down the local platform stack and delete PostgreSQL
# data while preserving Firebase Auth emulator data.
#
# Called from the root package's `dev:down` script. The teardown is destructive,
# so it prompts for confirmation when run interactively. Skip the prompt with
# -y/--yes/--force, or from a non-TTY such as CI.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"
POSTGRES_CONTAINER="roar-postgres"
POSTGRES_VOLUME="roar-postgres-data"

confirm_teardown() {
  local arg reply
  for arg in "$@"; do
    case "$arg" in
      -y | --yes | --force) return 0 ;;
    esac
  done

  [ -t 0 ] || return 0

  echo "WARNING: this stops the local ROAR stack and DELETES PostgreSQL data." >&2
  echo "         Firebase Auth emulator data is preserved." >&2
  read -r -p "Continue? [y/N] " reply
  case "$reply" in
    [Yy] | [Yy][Ee][Ss]) return 0 ;;
    *) return 1 ;;
  esac
}

if ! confirm_teardown "$@"; then
  echo "Aborted — the local stack and PostgreSQL data were left intact." >&2
  exit 0
fi

cd "$REPO_ROOT"

# Capture the volume currently mounted by Postgres before Compose removes the
# container. This also targets an anonymous volume created by the previous
# configuration, but only when it is still attached to the known ROAR container
# at the expected PostgreSQL mount point.
mounted_postgres_volume="$(
  docker inspect \
    --format '{{range .Mounts}}{{if and (eq .Type "volume") (eq .Destination "/var/lib/postgresql")}}{{println .Name}}{{end}}{{end}}' \
    "$POSTGRES_CONTAINER" 2>/dev/null || true
)"

echo "Stopping the local ROAR stack..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans

postgres_volumes=("$POSTGRES_VOLUME")
if [[ -n "$mounted_postgres_volume" && "$mounted_postgres_volume" != "$POSTGRES_VOLUME" ]]; then
  postgres_volumes+=("$mounted_postgres_volume")
fi

for volume in "${postgres_volumes[@]}"; do
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    docker volume rm "$volume" >/dev/null
    echo "Removed PostgreSQL volume $volume."
  fi
done

echo "Local ROAR stack stopped. Firebase Auth emulator data was preserved."
