#!/usr/bin/env bash
set -euo pipefail
set -x

PORT=5173
EMU_UI_PORT=4001
AUTH_PORT=9199
FS_PORT=8180

cleanup() {
  (test -f /tmp/vite.pid && kill "$(cat /tmp/vite.pid)" 2>/dev/null) || true
  (test -f /tmp/firebase.pid && kill "$(cat /tmp/firebase.pid)" 2>/dev/null) || true
  pkill -f "vite --force --host" 2>/dev/null || true
}
trap cleanup EXIT

kill_on_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti:"$port" | xargs -r kill -9 2>/dev/null || true
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  else
    echo "WARN: neither lsof nor fuser available to free port ${port}" >&2
  fi
}

# Clean up any previous runs and free ports
cleanup || true
kill_on_port "$PORT"
kill_on_port "$EMU_UI_PORT"
kill_on_port "$AUTH_PORT"
kill_on_port "$FS_PORT"

# Ensure ports are free
for p in "$PORT" "$EMU_UI_PORT" "$AUTH_PORT" "$FS_PORT"; do
  for i in $(seq 1 30); do
    (echo > /dev/tcp/127.0.0.1/$p) >/dev/null 2>&1 && { sleep 1; } || break
  done
done

# Start Firebase emulators (auth + firestore)
./node_modules/.bin/firebase emulators:start \
  --only auth,firestore \
  --project levante-admin-dev \
  --config firebase.json \
  > /tmp/firebase-emu.log 2>&1 &
echo $! > /tmp/firebase.pid

# Start Vite dev server over HTTP with emulator enabled, locked to 5173
VITE_HTTPS=FALSE \
VITE_LEVANTE=TRUE \
VITE_FIREBASE_PROJECT=DEV \
VITE_EMULATOR=TRUE \
./node_modules/.bin/vite --force --host --port "$PORT" \
  > /tmp/vite.log 2>&1 &
echo $! > /tmp/vite.pid

# Wait for Firebase Emulator UI and Vite to be ready
for i in $(seq 1 60); do
  curl -sSf http://127.0.0.1:${EMU_UI_PORT} >/dev/null && break || sleep 1
done
for i in $(seq 1 60); do
  curl -sSf http://localhost:${PORT}/signin >/dev/null && break || sleep 1
done

SEED="${E2E_SEED:-FALSE}"
if [ "$SEED" = "TRUE" ] || [ "$SEED" = "true" ]; then
  # Seed emulator user (idempotent)
  curl -sS -X POST \
    -H 'Content-Type: application/json' \
    -d '{"email":"student@levante.test","password":"student123","returnSecureToken":true}' \
    "http://127.0.0.1:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=dummy" \
    >/dev/null 2>&1 || true
fi

# Run Cypress locales emulator spec
E2E_USE_ENV=TRUE \
E2E_BASE_URL="http://localhost:${PORT}/signin" \
E2E_TEST_EMAIL=student@levante.test \
E2E_TEST_PASSWORD=student123 \
set +e
./node_modules/.bin/cypress run --e2e --spec "cypress/e2e/locales-emulator.cy.ts"
code=$?
set -e

if [ "$code" -ne 0 ]; then
  echo '--- Vite last lines ---'
  tail -n 120 /tmp/vite.log || true
  echo '--- Firebase last lines ---'
  tail -n 120 /tmp/firebase-emu.log || true
fi

exit "$code"


