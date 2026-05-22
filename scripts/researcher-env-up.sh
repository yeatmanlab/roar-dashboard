#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"
FIREBASE_CONFIG="$REPO_ROOT/apps/assessments/shared/firebase.json"

# Validate certs exist — the dev backend requires HTTPS (NODE_ENV=development reads them synchronously).
for cert_file in "$REPO_ROOT/certs/roar-local.key" "$REPO_ROOT/certs/roar-local.crt"; do
  if [[ ! -f "$cert_file" ]]; then
    echo "Error: $cert_file not found. Run: npm run dev:setup:certs" >&2
    exit 1
  fi
done

# Tear down any existing researcher-db to prevent port 5432 conflicts from orphaned containers.
docker compose -f "$COMPOSE_FILE" rm -sf researcher-db 2>/dev/null || true

npx concurrently \
  --kill-others-on-fail \
  --names emulator,backend,pa \
  --prefix-colors cyan,yellow,green \
  "npx firebase emulators:start --only auth --project demo-roar --config $FIREBASE_CONFIG" \
  "cd $REPO_ROOT/apps/backend && NODE_ENV=development \
   GOOGLE_CLOUD_PROJECT=demo-roar \
   CORE_DATABASE_URL=postgresql://postgres@localhost:5432/roar_core \
   ASSESSMENT_DATABASE_URL=postgresql://postgres@localhost:5432/roar_assessment \
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
   npm run dev" \
  "docker compose -f $COMPOSE_FILE run --rm -T researcher-db-migrate \
   && ROAR_API_URL=https://localhost:4000 npm run dev"
