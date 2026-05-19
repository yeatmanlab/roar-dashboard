#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"
FIREBASE_CONFIG="$REPO_ROOT/apps/assessments/shared/firebase.json"

# Tear down any existing researcher-db to prevent port 5432 conflicts from orphaned containers.
docker compose -f "$COMPOSE_FILE" rm -sf researcher-db 2>/dev/null || true

npx concurrently \
  --kill-others-on-fail \
  --names emulator,backend,pa \
  --prefix-colors cyan,yellow,green \
  "npx firebase emulators:start --only auth --project demo-roar --config $FIREBASE_CONFIG" \
  "NODE_ENV=development \
   GOOGLE_CLOUD_PROJECT=demo-roar \
   CORE_DATABASE_URL=postgresql://postgres@localhost:5432/roar_core \
   ASSESSMENT_DATABASE_URL=postgresql://postgres@localhost:5432/roar_assessment \
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
   npm run dev -w apps/backend" \
  "docker compose -f $COMPOSE_FILE run --rm -T researcher-db-migrate \
   && npm run dev -w apps/assessments/roar-pa"
