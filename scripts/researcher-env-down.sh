#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

# WARNING: -v removes the pgdata volume, permanently deleting all data in roar_core
# and roar_assessment. Ctrl+C on the dev servers does NOT destroy the database —
# only this script does. Stop here and use Ctrl+C instead if you want to keep your data.
docker compose -f "$COMPOSE_FILE" rm -sf researcher-db 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" down -v
