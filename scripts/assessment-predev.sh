#!/usr/bin/env bash
# assessment-predev.sh — preflight for an assessment's `npm run dev`.
#
# `npm run dev` serves an assessment against whatever backend and Firebase Auth
# emulator are already running. Two contexts satisfy that:
#   - the assessment environment (`npm start` brings its Docker stack up, then
#     runs `npm run dev`, which triggers this preflight via npm's predev hook), or
#   - platform-context dev: the platform Docker stack (repo root
#     `docker compose up -d --wait`) plus a host-run backend
#     (`NODE_ENV=development npm run dev -w apps/backend`).
#
# Dev bundles default FIREBASE_AUTH_EMULATOR_HOST to the local emulator
# (apps/assessments/shared/devEmulatorHost.cjs), so when a prerequisite is
# missing the failures are otherwise silent — sign-in network errors, or 401s on
# every /v1 request. Fail fast here and name the exact fix instead.
#
# Usage (from any assessment package.json):
#   "predev": "bash ../../../scripts/assessment-predev.sh"
set -euo pipefail

fail() {
  echo "Error: $1" >&2
  shift
  local line
  for line in "$@"; do
    echo "  $line" >&2
  done
  exit 1
}

# ── 1. The dev server's own port ─────────────────────────────────────────────
if lsof -i :8000 -sTCP:LISTEN >/dev/null 2>&1 || ss -tlnp 2>/dev/null | grep -q ':8000 '; then
  fail "port 8000 is already in use." \
    "A previous dev server (or another assessment) is still running — stop it first."
fi

# ── 2. The Firebase Auth emulator ────────────────────────────────────────────
if ! curl --silent --fail --max-time 2 http://127.0.0.1:9099/ >/dev/null 2>&1; then
  fail "no Firebase Auth emulator on 127.0.0.1:9099." \
    "Assessment environment: npm start" \
    "Platform context:       docker compose up -d --wait   (from the repo root)"
fi

# ── 3. The backend API ───────────────────────────────────────────────────────
# The scheme identifies the context: the containerized assessment-env backend
# serves plain HTTP; a host-run dev backend serves TLS (mkcert) unconditionally.
if curl --silent --fail --max-time 2 http://localhost:4000/health/live >/dev/null 2>&1; then
  backend_scheme=http
elif curl --silent --fail --insecure --max-time 2 https://localhost:4000/health/live >/dev/null 2>&1; then
  backend_scheme=https
else
  fail "no backend on localhost:4000." \
    "Assessment environment: npm start" \
    "Platform context:       NODE_ENV=development npm run dev -w apps/backend"
fi

# ── 4. Platform context only: emulator token verification ────────────────────
# The backend verifies tokens against the Auth emulator only when
# FIREBASE_AUTH_EMULATOR_HOST is set in its environment (see
# apps/backend/src/clients/firebase-core.client.ts). Without it, the assessment
# signs in against the emulator while the backend verifies against real
# Firebase, and every /v1 request 401s with no hint of why. The containerized
# backend sets the variable in compose; only the host-run backend can miss it.
if [[ "$backend_scheme" == "https" ]]; then
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  BACKEND_ENV="$REPO_ROOT/apps/backend/.env"
  if [[ ! -f "$BACKEND_ENV" ]] || ! grep -qE '^FIREBASE_AUTH_EMULATOR_HOST=.+' "$BACKEND_ENV"; then
    fail "the host-run backend is not configured for the Auth emulator." \
      "Add this line to apps/backend/.env, then restart the backend:" \
      "" \
      "  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099"
  fi
fi
