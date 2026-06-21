#!/usr/bin/env bash
# Creates an OpenFGA store and deploys the authorization model on first boot.
# Idempotent: if the env file already exists, skips creation.
#
# The store/model IDs are written to /fga-env/fga-env.json, a Docker volume
# shared with the backend. The seed script and server.ts read this file to
# set FGA_STORE_ID and FGA_MODEL_ID before the first FGA request.

set -euo pipefail

FGA_API_URL="${FGA_API_URL:-http://openfga:8080}"
FGA_ENV_FILE="/fga-env/fga-env.json"
MODEL_FILE="/authz/authorization-model.fga"

# Wait for OpenFGA to be ready (it may still be starting up)
echo "[openfga-init] Waiting for OpenFGA at ${FGA_API_URL}..."
for i in $(seq 1 30); do
  if curl -sf "${FGA_API_URL}/healthz" > /dev/null 2>&1; then
    echo "[openfga-init] OpenFGA is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "[openfga-init] ERROR: OpenFGA not ready after 30s" >&2
    exit 1
  fi
  sleep 1
done

# Skip if store already exists (idempotent across container restarts)
if [ -f "$FGA_ENV_FILE" ]; then
  echo "[openfga-init] Store already initialized, skipping."
  cat "$FGA_ENV_FILE"
  exit 0
fi

if [ ! -f "$MODEL_FILE" ]; then
  echo "[openfga-init] ERROR: Model file not found at ${MODEL_FILE}" >&2
  exit 1
fi

echo "[openfga-init] Creating FGA store and deploying model..."
RESULT=$(fga store create \
  --api-url "${FGA_API_URL}" \
  --model "${MODEL_FILE}" \
  --name "roar-dev" 2>&1)

STORE_ID=$(echo "$RESULT" | jq -r '.store.id // empty')
MODEL_ID=$(echo "$RESULT" | jq -r '.model.authorization_model_id // empty')

if [ -z "$STORE_ID" ] || [ -z "$MODEL_ID" ]; then
  echo "[openfga-init] ERROR: Failed to create store. Output:" >&2
  echo "$RESULT" >&2
  exit 1
fi

# Write env file for the backend to read
mkdir -p "$(dirname "$FGA_ENV_FILE")"
cat > "$FGA_ENV_FILE" <<-JSON
{
  "FGA_STORE_ID": "${STORE_ID}",
  "FGA_MODEL_ID": "${MODEL_ID}"
}
JSON

echo "[openfga-init] Store created: ${STORE_ID}, Model: ${MODEL_ID}"
