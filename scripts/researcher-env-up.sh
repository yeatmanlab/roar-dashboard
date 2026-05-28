#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"
FIREBASE_CONFIG="$REPO_ROOT/apps/assessments/shared/firebase.json"

# Canonical value: packages/assessment-schema/src/researcher-environment.ts (RESEARCHER_LOCAL_FIREBASE_PROJECT_ID)
RESEARCHER_LOCAL_FIREBASE_PROJECT_ID="demo-roar"

# Check global dependencies.
if ! docker compose version &>/dev/null; then
  echo "Error: 'docker compose' (v2) is required. Install Docker Desktop or Docker Engine with the Compose plugin." >&2
  exit 1
fi
if ! command -v java &>/dev/null; then
  echo "Error: Java is required for the Firebase Auth emulator. Install a JRE (e.g. brew install openjdk)." >&2
  exit 1
fi

# Validate certs exist — the dev backend requires HTTPS (NODE_ENV=development reads them synchronously).
for cert_file in "$REPO_ROOT/certs/roar-local.key" "$REPO_ROOT/certs/roar-local.crt"; do
  if [[ ! -f "$cert_file" ]]; then
    echo "Error: $cert_file not found. Run: npm run dev:setup:certs" >&2
    exit 1
  fi
done

# Check that port 5432 is free. The researcher-db container binds to it, and Docker will
# fail with a cryptic networking error if anything else already owns the port.
if lsof -i :5432 -sTCP:LISTEN &>/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ':5432 '; then
  echo "Error: port 5432 is already in use." >&2
  echo "  Stop any local PostgreSQL instance before starting the researcher environment:" >&2
  echo "    macOS (Homebrew): brew services stop postgresql@<version>" >&2
  echo "    Ubuntu/Debian:    sudo systemctl stop postgresql" >&2
  echo "    Docker container: docker ps | grep 5432" >&2
  exit 1
fi

# Tear down any existing researcher-db to prevent conflicts from orphaned containers.
docker compose -f "$COMPOSE_FILE" rm -sf researcher-db 2>/dev/null || true

npx concurrently \
  --kill-others-on-fail \
  --names emulator,backend,pa \
  --prefix-colors cyan,yellow,green \
  "npx firebase emulators:start --only auth --project $RESEARCHER_LOCAL_FIREBASE_PROJECT_ID --config $FIREBASE_CONFIG" \
  "cd $REPO_ROOT/apps/backend && NODE_ENV=development \
   GOOGLE_CLOUD_PROJECT=$RESEARCHER_LOCAL_FIREBASE_PROJECT_ID \
   CORE_DATABASE_URL=postgresql://postgres@localhost:5432/roar_core \
   ASSESSMENT_DATABASE_URL=postgresql://postgres@localhost:5432/roar_assessment \
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
   npm run dev" \
  "docker compose -f $COMPOSE_FILE run --rm -T researcher-db-migrate \
   && npx --yes wait-on tcp:localhost:4000 --timeout 60000 \
   && cd $REPO_ROOT/apps/assessments/roar-pa && FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run dev"
