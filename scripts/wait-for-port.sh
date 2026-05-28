#!/usr/bin/env bash
# Usage: wait-for-port.sh <port> [timeout_seconds]
# Polls http://localhost:<port> until it responds or the timeout expires.
set -euo pipefail

PORT="${1:?Usage: wait-for-port.sh <port> [timeout_seconds]}"
TIMEOUT="${2:-60}"
elapsed=0

until curl -sfk "https://localhost:$PORT/health" >/dev/null 2>&1; do
  sleep 1
  elapsed=$((elapsed + 1))
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "Error: timed out after ${TIMEOUT}s waiting for port $PORT" >&2
    exit 1
  fi
done
