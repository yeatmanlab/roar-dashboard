#!/usr/bin/env bash
# assessment-env-up.sh — Start the shared assessment infrastructure and the
# assessment dev server.
#
# Called from an assessment package's `start` script.
# Starts the shared Docker stack (DB, migrations, Firebase emulators, backend)
# then runs the dev server in the assessment directory that invoked this script.
#
# Its pre-flight checks are hard gates (unlike `npm run setup`, whose equivalent
# checks are advisory): `setup` is optional, so this script cannot assume it ran
# and must fail safe on its own.
#
# Usage (from any assessment package.json):
#   "start": "bash ../../../scripts/assessment-env-up.sh"
set -euo pipefail

# Shared context (REPO_ROOT, COMPOSE_FILE, ASSESSMENT_DIR, ASSESSMENT_NAME,
# PARAMS_FILE) and pre-flight checks. See assessment-common.sh.
source "$(cd "$(dirname "$0")" && pwd)/assessment-common.sh"

# Exported so docker compose can substitute ${ASSESSMENT_NAME} in the compose file.
export ASSESSMENT_NAME

# All host ports the stack binds: Postgres, Firebase Auth emulator, Storage
# emulator, Emulator UI, backend API.
STACK_PORTS=("$ASSESSMENT_PG_PORT" 9099 9199 9000 4000)

if ! docker_compose_available; then
  echo "Error: Docker with Compose v2 is required." >&2
  print_docker_install_help
  exit 1
fi

# Explain what is occupying a host port and how to free it. The most common
# culprits, in order: the platform dev stack, a local process, or another
# Docker container. (Stale assessment containers are force-removed before the
# port check runs, so they rarely reach this diagnosis.)
diagnose_port_conflict() {
  local port="$1"
  echo "Error: port ${port} is already in use." >&2

  # A Docker container publishing the port? Compose labels tell us which stack.
  local container project
  container="$(docker ps --filter "publish=${port}" --format '{{.Names}}' 2>/dev/null | head -1)"
  if [[ -n "$container" ]]; then
    project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container" 2>/dev/null || true)"
    case "$project" in
      roar-platform)
        echo "  The ROAR platform dev stack is running (container: ${container})." >&2
        echo "  Stop it first, from the repository root:" >&2
        echo "    docker compose down" >&2
        ;;
      roar-assessment)
        echo "  A previous assessment environment is still partially running (container: ${container})." >&2
        echo "  Reset it first:" >&2
        echo "    npm run stop   # or: bash scripts/assessment-env-down.sh" >&2
        ;;
      *)
        echo "  A Docker container is holding the port: ${container}" >&2
        echo "  Stop it with:" >&2
        echo "    docker stop ${container}" >&2
        ;;
    esac
    return
  fi

  # Not a container — a host process. The Postgres port gets tailored advice:
  # a local PostgreSQL install is a common culprit, and the port is overridable
  # when the clash is intentional.
  if [[ "$port" == "$ASSESSMENT_PG_PORT" ]]; then
    echo "  A local PostgreSQL instance may be running. Stop it, or pick another port:" >&2
    echo "    macOS (Homebrew): brew services stop postgresql@<version>" >&2
    echo "    Ubuntu/Debian:    sudo systemctl stop postgresql" >&2
    echo "    Or:               ASSESSMENT_PG_PORT=<port> npm start" >&2
    return
  fi

  local proc
  proc="$(lsof -i ":${port}" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1 " (pid " $2 ")"}')"
  if [[ -n "$proc" ]]; then
    echo "  Held by: ${proc}. Stop that process and retry." >&2
  else
    echo "  Find the process with: lsof -i :${port}  (or: ss -tlnp | grep ${port})" >&2
  fi
}

# If the backend container is already running the full stack is up — the backend
# only starts after migrations and the Firebase emulators are healthy. This covers
# the common case where the user killed the dev server with Ctrl+C but left the
# Docker stack running. Skip straight to restarting the dev server.
if assessment_container_running assessment-backend; then
  echo "Assessment environment already running. Starting assessment dev server..."
else
  # Require the config file before Docker tries to seed from it.
  if [ ! -f "$PARAMS_FILE" ]; then
    print_params_file_missing_help
    exit 1
  fi

  # Force-remove stale containers by name before starting. These linger from a
  # previous run and cause name or port conflicts — including containers left
  # under an older compose project name (docker rm by name ignores project
  # scoping, unlike --remove-orphans) and the retired "firebase-auth-emulator"
  # container name from older checkouts. Runs before the port preflight so
  # leftovers from a previous assessment run self-heal instead of erroring.
  docker rm -f \
    assessment-db \
    assessment-db-migrate \
    firebase-auth-emulator \
    firebase-emulator \
    assessment-backend \
    2>/dev/null || true

  # Check every port the stack binds before Docker tries to — the error Docker
  # produces when a port is taken is cryptic, and the fix differs by culprit.
  for port in "${STACK_PORTS[@]}"; do
    if port_in_use "$port"; then
      diagnose_port_conflict "$port"
      exit 1
    fi
  done

  echo "Starting assessment environment (DB, migrations, Firebase emulators, backend)..."

  # --remove-orphans drops any container in the roar-assessment project whose
  # service no longer exists, so future service renames self-heal without
  # needing to be listed above.
  docker compose -f "$COMPOSE_FILE" up -d --wait --remove-orphans

  echo "All services healthy. Starting assessment dev server..."
fi
cd "$ASSESSMENT_DIR"

# Vite-based assessments (e.g. roar-survey) have no webpack.config.cjs.
# Use vite for those; webpack for everything else.
if [[ -f "$ASSESSMENT_DIR/webpack.config.cjs" ]]; then
  exec env \
    FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
    BACKEND_URL=http://localhost:4000 \
    npx webpack serve --open --mode development --env dbmode=development
else
  exec env \
    FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
    BACKEND_URL=http://localhost:4000 \
    npx vite --mode development
fi
