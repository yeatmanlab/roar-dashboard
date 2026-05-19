#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

docker compose -f "$COMPOSE_FILE" rm -sf researcher-db 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" down -v
