#!/usr/bin/env bash
set -euo pipefail

# Clean up any previous runs
(test -f /tmp/vite.pid && kill "$(cat /tmp/vite.pid)" 2>/dev/null) || true
(test -f /tmp/firebase.pid && kill "$(cat /tmp/firebase.pid)" 2>/dev/null) || true
pkill -f "vite --force --host" 2>/dev/null || true

# Start Firebase emulators (auth + firestore)
./node_modules/.bin/firebase emulators:start \
  --only auth,firestore \
  --project levante-admin-dev \
  --config firebase.json \
  > /tmp/firebase-emu.log 2>&1 &
echo $! > /tmp/firebase.pid

# Start Vite dev server over HTTP with emulator enabled
VITE_HTTPS=FALSE \
VITE_LEVANTE=TRUE \
VITE_FIREBASE_PROJECT=DEV \
VITE_EMULATOR=TRUE \
./node_modules/.bin/vite --force --host --port 5173 \
  > /tmp/vite.log 2>&1 &
echo $! > /tmp/vite.pid

# Wait for Firebase Emulator UI (auth/firestore) and Vite to be ready
for i in $(seq 1 60); do
  curl -sSf http://127.0.0.1:4001 >/dev/null && break || sleep 1
done
for i in $(seq 1 60); do
  curl -sSf http://localhost:5173/signin >/dev/null && break || sleep 1
done

# Seed emulator user (idempotent)
curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@levante.test","password":"student123","returnSecureToken":true}' \
  'http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=dummy' \
  >/dev/null 2>&1 || true

# Run Cypress locales emulator spec
E2E_USE_ENV=TRUE \
E2E_BASE_URL=http://localhost:5173/signin \
E2E_TEST_EMAIL=student@levante.test \
E2E_TEST_PASSWORD=student123 \
./node_modules/.bin/cypress run --e2e --spec "cypress/e2e/locales-emulator.cy.ts" || code=$?

code=${code:-0}

# Teardown
(test -f /tmp/vite.pid && kill "$(cat /tmp/vite.pid)" 2>/dev/null) || true
(test -f /tmp/firebase.pid && kill "$(cat /tmp/firebase.pid)" 2>/dev/null) || true

if [ "$code" -ne 0 ]; then
  echo '--- Vite last lines ---'
  tail -n 80 /tmp/vite.log || true
  echo '--- Firebase last lines ---'
  tail -n 80 /tmp/firebase-emu.log || true
fi

exit "$code"


