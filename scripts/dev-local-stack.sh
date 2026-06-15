#!/usr/bin/env bash
#
# dev-local-stack.sh — run the full ROAR stack locally, mirroring the CI
# `e2e-tests` job, so you can sign in to the dashboard as a seeded fixture user
# (including a super admin) without touching the deployed dev backend.
#
# What it starts, in order:
#   1. Postgres + OpenFGA            (docker compose, docker-compose.local-dev.yml)
#   2. Test databases               (db:create-test-dbs)
#   3. Firebase Auth emulator       (firebase-tools, :9099, project demo-roar)
#   4. Backend server-test          (:4000 — seeds DB + FGA tuples + emulator users)
#   5. Dashboard dev server         (vite, https://localhost:5173, emulator mode)
#
# Everything is torn down on Ctrl-C. Background-service logs live in .local-dev-logs/.
#
# Prerequisites: Docker, a Java runtime (the Auth emulator needs a JRE —
# `brew install openjdk` on macOS), and launching via `npm run dev:local`.
#
# Overridable env: ROAR_LOCAL_PG_PORT (5432), ROAR_LOCAL_FGA_PORT (8080),
# ROAR_LOCAL_AUTH_PORT (9099), ROAR_LOCAL_BACKEND_PORT (4000), GCLOUD_PROJECT
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

PG_PORT="${ROAR_LOCAL_PG_PORT:-5432}"
FGA_PORT="${ROAR_LOCAL_FGA_PORT:-8080}"
AUTH_PORT="${ROAR_LOCAL_AUTH_PORT:-9099}"
BACKEND_PORT="${ROAR_LOCAL_BACKEND_PORT:-4000}"
# Vite's port is intentionally fixed (no ROAR_LOCAL_* override): the backend's
# default ALLOWED_ORIGINS and the dashboard CSP both pin https://localhost:5173,
# so overriding it here alone would break CORS. Move all three together to change it.
DASHBOARD_PORT=5173
PROJECT="${GCLOUD_PROJECT:-demo-roar}"

COMPOSE_FILE="$ROOT/docker-compose.local-dev.yml"
LOG_DIR="$ROOT/.local-dev-logs"
LOCAL_ENV_FILE="$ROOT/apps/dashboard/env-configs/.env.development.local"
mkdir -p "$LOG_DIR"

# Backend environment (mirrors the CI e2e-tests job).
export CORE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/roar_core_test"
export ASSESSMENT_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/roar_assessment_test"
export POSTGRES_ADMIN_URL="postgresql://postgres:postgres@127.0.0.1:${PG_PORT}/postgres"
export FGA_API_URL="http://127.0.0.1:${FGA_PORT}"
export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:${AUTH_PORT}"
export GCLOUD_PROJECT="$PROJECT"
export PORT="$BACKEND_PORT"
# Leave ALLOWED_ORIGINS unset: server-test defaults it to https://localhost:5173,
# the Vite dev origin, so dashboard requests pass CORS.

EMULATOR_PID=""
SERVER_PID=""
MANAGED_LOCAL_ENV=0

cleanup() {
  echo ""
  log "Shutting down..."
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null || true
  if [[ -n "$EMULATOR_PID" ]]; then
    pkill -P "$EMULATOR_PID" 2>/dev/null || true   # the emulator's Java child
    kill "$EMULATOR_PID" 2>/dev/null || true
  fi
  docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true
  if [[ "$MANAGED_LOCAL_ENV" == "1" ]]; then
    rm -f "$LOCAL_ENV_FILE"
    log "Removed managed $LOCAL_ENV_FILE"
  fi
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
command -v java >/dev/null 2>&1 || log "WARNING: 'java' not found — the Firebase Auth emulator needs a JRE (e.g. 'brew install openjdk')."

# Fail fast on port conflicts (before starting any container), naming the override.
preflight_ok=1
check_free() {
  local port="$1" name="$2" hint="$3"
  if port_open 127.0.0.1 "$port"; then
    log "ERROR: port ${port} (${name}) is already in use — ${hint}"
    preflight_ok=0
  fi
}
check_free "$PG_PORT" "Postgres" "set ROAR_LOCAL_PG_PORT=<free port>."
check_free "$FGA_PORT" "OpenFGA" "set ROAR_LOCAL_FGA_PORT=<free port>."
check_free "$AUTH_PORT" "Firebase Auth emulator" "set ROAR_LOCAL_AUTH_PORT=<free port> (or stop a leftover emulator)."
check_free "$BACKEND_PORT" "backend" "set ROAR_LOCAL_BACKEND_PORT=<free port>."
check_free "$DASHBOARD_PORT" "dashboard (vite)" "stop whatever is using ${DASHBOARD_PORT}."
[[ "$preflight_ok" == "1" ]] || { log "Aborting due to port conflicts (no containers started)."; exit 1; }

# ── 1. Postgres + OpenFGA ────────────────────────────────────────────────────
log "Starting Postgres + OpenFGA (docker compose)..."
# `--wait` blocks until healthchecks pass (Postgres has a pg_isready healthcheck),
# so we don't race a still-initializing Postgres — a bare TCP check passes as soon
# as Docker maps the port, while initdb is still resetting early connections.
ROAR_LOCAL_PG_PORT="$PG_PORT" ROAR_LOCAL_FGA_PORT="$FGA_PORT" \
  docker compose -f "$COMPOSE_FILE" up -d --wait
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

# ── 3. Firebase Auth emulator ────────────────────────────────────────────────
if [[ ! -x "$ROOT/node_modules/.bin/firebase" ]]; then
  log "Installing firebase-tools (one-time, --no-save)..."
  run_npm install --no-save firebase-tools@15
fi
log "Starting Firebase Auth emulator (project ${PROJECT}, :${AUTH_PORT})..."
cat > "$LOG_DIR/firebase.json" <<EOF
{ "emulators": { "auth": { "host": "127.0.0.1", "port": ${AUTH_PORT} }, "ui": { "enabled": false } } }
EOF
"$ROOT/node_modules/.bin/firebase" emulators:start \
  --only auth --project "$PROJECT" --config "$LOG_DIR/firebase.json" \
  > "$LOG_DIR/auth-emulator.log" 2>&1 &
EMULATOR_PID=$!
wait_for_tcp 127.0.0.1 "$AUTH_PORT" "Firebase Auth emulator" 120

# ── 4. Backend (server-test) ─────────────────────────────────────────────────
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

# ── 5. Dashboard (emulator mode) ─────────────────────────────────────────────
# dotenvx loads env-configs/.env.development with override:true in development,
# so a plain inline VITE_* would be clobbered. The intended override channel is
# env-configs/.env.development.local (loaded last, gitignored). Manage it here.
if [[ -f "$LOCAL_ENV_FILE" ]]; then
  log "Using existing $LOCAL_ENV_FILE (not managed by this script)."
  log "  Ensure it sets: VITE_FIREBASE_EMULATOR_ENABLED=true and VITE_ROAR_API_BASE_URL=http://localhost:${BACKEND_PORT}/v1"
else
  cat > "$LOCAL_ENV_FILE" <<EOF
# Auto-generated by scripts/dev-local-stack.sh for local Firebase Auth emulator
# development. Removed automatically when the script exits. Safe to delete.
# NOTE: the backend mounts routes under /v1 (routes/index.ts) and the ts-rest
# contract has no global /v1 prefix, so the base URL must include /v1.
VITE_FIREBASE_EMULATOR_ENABLED=true
VITE_ROAR_API_BASE_URL=http://localhost:${BACKEND_PORT}/v1
EOF
  MANAGED_LOCAL_ENV=1
  log "Wrote managed $LOCAL_ENV_FILE (emulator mode)."
fi

log "Building dashboard workspace dependencies..."
run_turbo build --filter=@roar-platform/api-contract

echo ""
log "Stack is up. Open https://localhost:${DASHBOARD_PORT} and sign in as the 'superAdmin' fixture above."
log "Ctrl-C to tear everything down."
echo ""
run_npm run dev -w apps/dashboard
