#!/usr/bin/env bash
#
# dev-local-stack.sh — run the full ROAR stack locally, mirroring the CI
# `e2e-tests` job, so you can sign in to the dashboard as a seeded fixture user
# (including a super admin) without touching the deployed dev backend.
#
# What it starts, in order:
#   1. Postgres + OpenFGA + Firebase Auth emulator  (docker compose)
#   2. Test databases               (db:create-test-dbs)
#   3. Backend server-test          (:4000 — seeds DB + FGA tuples + emulator users)
#   4. Dashboard dev server         (vite, https://localhost:5173, emulator mode)
#
# Everything is torn down on Ctrl-C. Background-service logs live in .local-dev-logs/.
#
# Prerequisites: Docker (the Auth emulator runs in a container — no Java or
# firebase-tools needed on the host), and launching via `npm run dev:local`.
#
# Overridable env: ROAR_PG_PORT (5432), ROAR_FGA_PORT (8080),
# ROAR_AUTH_PORT (9099), ROAR_LOCAL_BACKEND_PORT (4000), GCLOUD_PROJECT
# (demo-roar).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { echo "[dev-local] $*"; }

# ── Use the npm that launched us, not PATH ───────────────────────────────────
# Inside an `npm run` script, `npm`/`npx` on PATH can resolve to a stale npm
# bundled deep in node_modules — it errors under Node 24 and its ancient npx
# can't parse `npx --yes wait-on tcp:...`. So call the launching npm by path,
# invoke local bins (turbo, firebase) directly, and avoid `npx` altogether.
if [[ -z "${npm_execpath:-}" ]]; then
  log "ERROR: npm_execpath is not set. Run via 'npm run dev:local', not 'bash scripts/dev-local-stack.sh'."
  exit 1
fi
run_npm() { node "$npm_execpath" "$@"; }
run_turbo() {
  if [[ -x "$ROOT/node_modules/.bin/turbo" ]]; then
    "$ROOT/node_modules/.bin/turbo" "$@"
  else
    run_npm exec -- turbo "$@"
  fi
}

PG_PORT="${ROAR_PG_PORT:-5432}"
FGA_PORT="${ROAR_FGA_PORT:-8080}"
AUTH_PORT="${ROAR_AUTH_PORT:-9099}"
BACKEND_PORT="${ROAR_LOCAL_BACKEND_PORT:-4000}"
# Vite's port is intentionally fixed (no ROAR_LOCAL_* override): the backend's
# default ALLOWED_ORIGINS and the dashboard CSP both pin https://localhost:5173,
# so overriding it here alone would break CORS. Move all three together to change it.
DASHBOARD_PORT=5173
PROJECT="${GCLOUD_PROJECT:-demo-roar}"

LOG_DIR="$ROOT/.local-dev-logs"
mkdir -p "$LOG_DIR"

# Backend environment (mirrors the CI e2e-tests job).
export CORE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/roar_core_test"
export ASSESSMENT_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/roar_assessment_test"
export POSTGRES_ADMIN_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres"
# postgres_fdw dials the assessment DB from *inside* the Postgres container, where the
# host-mapped 127.0.0.1 the backend connects through does not loop back to the server.
# Point the foreign server at the container's local Unix socket — always reachable, and
# independent of the host port mapping. Consumed by setupFdwForTests() in server-test.
export FDW_ASSESSMENT_HOST="/var/run/postgresql"
export FDW_ASSESSMENT_PORT="5432"
export FGA_API_URL="http://127.0.0.1:${FGA_PORT}"
export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:${AUTH_PORT}"
export GCLOUD_PROJECT="$PROJECT"
export PORT="$BACKEND_PORT"
# Leave ALLOWED_ORIGINS unset: server-test defaults it to https://localhost:5173,
# the Vite dev origin, so dashboard requests pass CORS.

SERVER_PID=""

cleanup() {
  echo ""
  log "Shutting down..."
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null || true
  docker compose down >/dev/null 2>&1 || true
  log "Done."
}
trap cleanup EXIT INT TERM

# ── Port helpers (no external deps; nc preferred, /dev/tcp fallback) ──────────
port_open() {
  local host="$1" port="$2"
  if command -v nc >/dev/null 2>&1; then
    nc -z "$host" "$port" >/dev/null 2>&1
  else
    (exec 3<>"/dev/tcp/${host}/${port}") >/dev/null 2>&1
  fi
}

wait_for_tcp() {
  local host="$1" port="$2" name="$3" timeout="${4:-60}" i=0
  log "Waiting for ${name} on ${host}:${port} (up to ${timeout}s)..."
  until port_open "$host" "$port"; do
    i=$((i + 1))
    if [[ "$i" -ge "$timeout" ]]; then
      log "ERROR: timed out waiting for ${name} on ${host}:${port}. See ${LOG_DIR}/*.log"
      return 1
    fi
    sleep 1
  done
  log "${name} is up."
}

# ── Preflight ────────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || { log "ERROR: docker is required."; exit 1; }
docker compose version >/dev/null 2>&1 || { log "ERROR: docker compose v2 is required."; exit 1; }

# Fail fast on port conflicts (before starting any container), naming the override.
preflight_ok=1
check_free() {
  local port="$1" name="$2" hint="$3"
  if port_open 127.0.0.1 "$port"; then
    log "ERROR: port ${port} (${name}) is already in use — ${hint}"
    preflight_ok=0
  fi
}
check_free "$PG_PORT" "Postgres" "set ROAR_PG_PORT=<free port>."
check_free "$FGA_PORT" "OpenFGA" "set ROAR_FGA_PORT=<free port>."
check_free "$AUTH_PORT" "Firebase Auth emulator" "set ROAR_AUTH_PORT=<free port> (or stop a leftover emulator)."
check_free "$BACKEND_PORT" "backend" "set ROAR_LOCAL_BACKEND_PORT=<free port>."
check_free "$DASHBOARD_PORT" "dashboard (vite)" "stop whatever is using ${DASHBOARD_PORT}."
[[ "$preflight_ok" == "1" ]] || { log "Aborting due to port conflicts (no containers started)."; exit 1; }

# ── 1. Postgres + OpenFGA + Firebase Auth emulator ─────────────────────────
log "Starting Postgres + OpenFGA + Firebase Auth emulator (docker compose)..."
# `--wait` blocks until healthchecks pass (Postgres and Auth emulator have
# healthchecks), so we don't race a still-initializing service.
ROAR_PG_PORT="$PG_PORT" ROAR_FGA_PORT="$FGA_PORT" ROAR_AUTH_PORT="$AUTH_PORT" \
  GCLOUD_PROJECT="$PROJECT" \
  docker compose up -d --wait --build
wait_for_tcp 127.0.0.1 "$FGA_PORT" "OpenFGA" 60

# ── 2. Test databases ────────────────────────────────────────────────────────
log "Creating test databases (idempotent)..."
db_attempts=0
until run_npm run db:create-test-dbs -w apps/backend; do
  db_attempts=$((db_attempts + 1))
  if [[ "$db_attempts" -ge 5 ]]; then
    log "ERROR: could not create test databases after ${db_attempts} attempts (Postgres on ${PG_PORT})."
    exit 1
  fi
  log "Postgres not ready yet (attempt ${db_attempts}); retrying in 3s..."
  sleep 3
done

# ── 3. Backend (server-test) ─────────────────────────────────────────────────
log "Building backend test server..."
export BUILD_TEST_SERVER=true
run_turbo build --filter=roar-backend
unset BUILD_TEST_SERVER
log "Starting backend (server-test) — seeds DB + FGA tuples + emulator users..."
node apps/backend/dist/server-test.js > "$LOG_DIR/server-test.log" 2>&1 &
SERVER_PID=$!
wait_for_tcp 127.0.0.1 "$BACKEND_PORT" "Backend (server-test)" 120

log "Seeded fixture logins (from /tmp/roar-cypress-fixture.json):"
node -e '
try {
  const f = require("/tmp/roar-cypress-fixture.json");
  for (const [k, u] of Object.entries(f.users)) {
    console.log("    " + k.padEnd(16) + " " + u.email + "   password: " + u.password);
  }
} catch (e) {
  console.log("    (fixture file not found — check .local-dev-logs/server-test.log)");
}' || true

# ── 4. Dashboard ─────────────────────────────────────────────────────────────
# VITE_FIREBASE_EMULATOR_AUTH_HOST and VITE_ROAR_API_BASE_URL are set in
# env-configs/.env.development — no local override file needed.
log "Building dashboard workspace dependencies..."
run_turbo build --filter=@roar-platform/api-contract

echo ""
log "Stack is up. Open https://localhost:${DASHBOARD_PORT} and sign in as the 'superAdmin' fixture above."
log "Ctrl-C to tear everything down."
echo ""
run_npm run dev -w apps/dashboard
