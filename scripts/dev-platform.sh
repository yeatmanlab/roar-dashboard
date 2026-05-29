#!/usr/bin/env bash
# Starts the Firebase Auth emulator and the assessment dev server for platform developers.
#
# Called from an assessment package's dev:platform script.
# Starts the Firebase Auth emulator then runs `npm run dev` in the assessment
# directory that invoked this script.
#
# Prerequisites (managed by you, not this script):
#   - Local PostgreSQL running on port 5432
#   - Backend running on port 4000 with FIREBASE_AUTH_EMULATOR_HOST set in apps/backend/.env
#   - TLS certs generated (npm run dev:setup:certs)
#   - Java installed (required by the Firebase Auth emulator)
#
# Usage (from any assessment package.json):
#   "dev:platform": "bash ../../../scripts/dev-platform.sh"
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSESSMENT_DIR="$(pwd)"
FIREBASE_CONFIG="$REPO_ROOT/apps/assessments/shared/firebase.json"
# Canonical value: packages/assessment-schema/src/firebase-emulator.ts (FIREBASE_EMULATOR_PROJECT_ID)
EMULATOR_PROJECT_ID="demo-roar"
EMULATOR_HOST="127.0.0.1:9099"
BACKEND_ENV="$REPO_ROOT/apps/backend/.env"

# Java is required by the Firebase Auth emulator.
if ! command -v java &>/dev/null; then
  echo "Error: Java is required for the Firebase Auth emulator. Install a JRE (e.g. brew install openjdk)." >&2
  exit 1
fi

# TLS certs are required by the backend in NODE_ENV=development.
for cert_file in "$REPO_ROOT/certs/roar-local.key" "$REPO_ROOT/certs/roar-local.crt"; do
  if [[ ! -f "$cert_file" ]]; then
    echo "Error: $cert_file not found. Run: npm run dev:setup:certs" >&2
    exit 1
  fi
done

# Platform devs run a local postgres instance — this is a prerequisite, not something this script starts.
if ! lsof -i :5432 -sTCP:LISTEN &>/dev/null 2>&1 && ! ss -tlnp 2>/dev/null | grep -q ':5432 '; then
  echo "Error: no PostgreSQL detected on port 5432." >&2
  echo "  Start your local postgres instance before running this script." >&2
  exit 1
fi

# The backend must have FIREBASE_AUTH_EMULATOR_HOST set so it validates emulator-issued tokens
# rather than real Firebase tokens. Check the .env file before proceeding — if it's absent or
# unset, the backend will silently reject every token the assessment sends.
if [[ ! -f "$BACKEND_ENV" ]]; then
  echo "Error: apps/backend/.env not found." >&2
  echo "  Copy apps/backend/.env.example to apps/backend/.env, fill in your database URLs," >&2
  echo "  and add:" >&2
  echo "" >&2
  echo "    FIREBASE_AUTH_EMULATOR_HOST=$EMULATOR_HOST" >&2
  echo "" >&2
  exit 1
fi

if ! grep -qE "^FIREBASE_AUTH_EMULATOR_HOST=.+" "$BACKEND_ENV"; then
  echo "Error: FIREBASE_AUTH_EMULATOR_HOST is not set in apps/backend/.env." >&2
  echo "  Add this line, then restart the backend before running this script:" >&2
  echo "" >&2
  echo "    FIREBASE_AUTH_EMULATOR_HOST=$EMULATOR_HOST" >&2
  echo "" >&2
  exit 1
fi

# The backend must be running before the assessment dev server starts.
if ! curl -sfk "https://localhost:4000/health" >/dev/null 2>&1; then
  echo "Error: backend not detected on https://localhost:4000." >&2
  echo "  Start it with: NODE_ENV=development npm run dev -w apps/backend" >&2
  echo "  Ensure apps/backend/.env has FIREBASE_AUTH_EMULATOR_HOST=$EMULATOR_HOST" >&2
  exit 1
fi

npx concurrently \
  --kill-others-on-fail \
  --names emulator,assessment \
  --prefix-colors cyan,green \
  "npx firebase emulators:start --only auth --project $EMULATOR_PROJECT_ID --config $FIREBASE_CONFIG" \
  "until curl -s http://localhost:9099/ >/dev/null 2>&1; do sleep 1; done \
   && cd $ASSESSMENT_DIR && FIREBASE_AUTH_EMULATOR_HOST=$EMULATOR_HOST npm run dev:server"
