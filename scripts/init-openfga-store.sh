#!/usr/bin/env bash
# init-openfga-store.sh — Create an OpenFGA store, deploy the authorization model,
# and print the env vars needed by apps/backend.
#
# Prerequisites:
#   - FGA CLI installed: brew install openfga/tap/fga
#   - jq installed: brew install jq
#   - OpenFGA server running: docker compose up
#
# Note: Re-running this script creates a new store each time. Only the most recently
# printed IDs should be used in your .env file.
#
# Usage: npm run fga:init -w apps/backend

set -euo pipefail

FGA_API_URL="${FGA_API_URL:-https://localhost:5050}"
MODEL_FILE="packages/authz/authorization-model.fga"

# Resolve model file relative to the repo root
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_PATH="$REPO_ROOT/$MODEL_FILE"

if [[ ! -f "$MODEL_PATH" ]]; then
  echo "Error: Model file not found at $MODEL_PATH" >&2
  exit 1
fi

if ! command -v fga &>/dev/null; then
  echo "Error: fga CLI not found. Install it with: brew install openfga/tap/fga" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "Error: jq not found. Install it with: brew install jq" >&2
  exit 1
fi

echo "Validating authorization model..."
fga model validate --file "$MODEL_PATH"

echo "Creating OpenFGA store and deploying model..."

RESULT=$(fga store create \
  --api-url "$FGA_API_URL" \
  --model "$MODEL_PATH" \
  --name "roar-local" 2>&1)

STORE_ID=$(echo "$RESULT" | jq -r '.store.id')
MODEL_ID=$(echo "$RESULT" | jq -r '.model.authorization_model_id')

if [[ -z "$STORE_ID" || "$STORE_ID" == "null" ]]; then
  echo "Error: Failed to create store. Output:" >&2
  echo "$RESULT" >&2
  exit 1
fi

echo ""
echo "OpenFGA store created successfully."
echo ""
echo "Add these to your apps/backend/.env:"
echo "  FGA_API_URL=$FGA_API_URL"
echo "  FGA_STORE_ID=$STORE_ID"
echo "  FGA_MODEL_ID=$MODEL_ID"
