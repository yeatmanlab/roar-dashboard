#!/usr/bin/env bash
# assessment-common.sh — Shared context and pre-flight checks for the assessment
# environment scripts (assessment-setup, assessment-env-up, assessment-seed-tasks,
# assessment-restart, assessment-env-build, assessment-env-down).
#
# SOURCE this file, don't execute it:
#   source "$(cd "$(dirname "$0")" && pwd)/assessment-common.sh"
#
# It provides *detection* (predicates) and *canonical messages* only — never the
# policy. Each script decides whether a failed check is a hard error (exit) or an
# advisory warning, so the shared idioms and wording don't drift across scripts
# while the hard/soft decision stays visible in the calling script.
#
# On source it sets, from this file's own location and the caller's working
# directory (an assessment directory):
#   REPO_ROOT        Absolute path to the monorepo root
#   COMPOSE_FILE     Absolute path to docker-compose.assessment.yml
#   ASSESSMENT_DIR   Absolute path to the calling assessment directory
#   ASSESSMENT_NAME  The assessment's directory name (e.g. roar-pa)
#   PARAMS_FILE      Absolute path to the assessment's taskVariantParameters.json

# Repo root is derived from this file's location so it's independent of the
# caller's cwd; the assessment context is derived from the cwd, since each
# calling script is invoked from its assessment directory via package.json.
_assessment_common_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$_assessment_common_dir/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.assessment.yml"
ASSESSMENT_DIR="$(pwd)"
ASSESSMENT_NAME="$(basename "$ASSESSMENT_DIR")"
PARAMS_FILE="$ASSESSMENT_DIR/taskVariantParameters.json"

# Host port the ephemeral assessment Postgres publishes. Defaults to 5433 so the
# ephemeral stack can run alongside a persistent platform-dev Postgres on 5432
# (docker-compose.yml, ROAR_PG_PORT). Exported so docker-compose.assessment.yml
# publishes the same port the scripts connect to; override ASSESSMENT_PG_PORT to change it.
export ASSESSMENT_PG_PORT="${ASSESSMENT_PG_PORT:-5433}"

# All host ports the assessment stack binds: Postgres, Firebase Auth emulator,
# Storage emulator, Emulator UI, backend API. Looped by the port pre-flights in
# assessment-setup.sh (advisory) and assessment-env-up.sh (hard gate).
STACK_PORTS=("$ASSESSMENT_PG_PORT" 9099 9199 9000 4000)

# The npm to use for nested npm calls. When npm runs a lifecycle script
# (`npm run <script>`) it prepends every ancestor node_modules/.bin to PATH,
# which can shadow `npm` itself with an old vendored copy — this repo transitively
# pulls npm@5 via @bdelab/jscat → optimization-js → semantic-release-cli, hoisted
# to the root node_modules/.bin/npm. Resolve the npm that is actually running this
# script from the vars npm sets, so nested `npm` calls hit the real npm rather than
# the PATH-shadowed one. Fall back to PATH `npm` when run directly (outside
# `npm run`, PATH is not shadowed). Invoke as: "${NPM_CLI[@]}" <args>
if [ -n "${npm_execpath:-}" ] && [ -n "${npm_node_execpath:-}" ]; then
  NPM_CLI=("$npm_node_execpath" "$npm_execpath")
else
  NPM_CLI=(npm)
fi

# ── Detection predicates (no output, no exit — return 0/1) ────────────────────

# True when Docker with Compose v2 is available.
docker_compose_available() {
  docker compose version &>/dev/null
}

# True when the given TCP port is already bound (lsof on macOS, ss on Linux).
# Usage: port_in_use 5433
port_in_use() {
  lsof -i ":$1" -sTCP:LISTEN &>/dev/null || ss -tlnp 2>/dev/null | grep -q ":$1 "
}

# True when the named container is running.
# Usage: assessment_container_running assessment-db
assessment_container_running() {
  docker ps --filter "name=$1" --filter "status=running" -q 2>/dev/null | grep -q .
}

# ── Canonical help messages (to stderr) ──────────────────────────────────────

# Docker (Compose v2) install options.
print_docker_install_help() {
  echo "  macOS:         brew install --cask docker   (then launch Docker Desktop)" >&2
  echo "  Ubuntu/Debian: curl -fsSL https://get.docker.com | sh" >&2
  echo "                 sudo usermod -aG docker \$USER   (then log out/in)" >&2
}

# Diagnose what is occupying a host port and print how to free it. Prints only
# the diagnosis — no headline and no exit — so the caller decides whether the
# conflict is a hard error (env-up) or an advisory warning (setup). The most
# common culprits, in order: the platform dev stack, a local process, or another
# Docker container. (env-up force-removes stale assessment containers before its
# port check, so those rarely reach this diagnosis.)
# Callers run under set -euo pipefail, so every probe here is failure-tolerant
# (|| true): a dead Docker daemon or a missing lsof must degrade the diagnosis,
# not abort the calling script mid-check.
# Usage: diagnose_port_conflict 5433
diagnose_port_conflict() {
  local port="$1"

  # A Docker container publishing the port? Compose labels tell us which stack.
  local container project
  container="$(docker ps --filter "publish=${port}" --format '{{.Names}}' 2>/dev/null | head -1 || true)"
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
  proc="$(lsof -i ":${port}" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1 " (pid " $2 ")"}' || true)"
  if [[ -n "$proc" ]]; then
    echo "  Held by: ${proc}. Stop that process and retry." >&2
  else
    echo "  Find the process with: lsof -i :${port}  (or: ss -tlnp | grep ${port})" >&2
  fi
}

# taskVariantParameters.json is missing — how to create it.
print_params_file_missing_help() {
  echo "Error: taskVariantParameters.json not found in $ASSESSMENT_DIR." >&2
  echo "  Create it with 'npm run setup', or copy the example yourself from this directory:" >&2
  echo "    cp taskVariantParameters.example.json taskVariantParameters.json" >&2
}

# ── Destructive-action confirmation ───────────────────────────────────────────

# Prompt before an irreversible teardown (stop / restart delete the DB volume).
# Returns 0 to proceed, 1 to abort. Skips the prompt (returns 0) on a non-TTY
# (CI, pipes) or when -y/--yes/--force is present in the passed args, so automation
# and already-confirmed callers aren't blocked. Prints only the warning + prompt;
# the caller prints its own "Aborted …" message and picks the exit code — both
# callers exit 0, since a decline is a valid choice (not an error) and npm
# shouldn't print a "lifecycle script failed" wrapper.
# Usage:  if ! confirm_teardown "$@"; then echo "Aborted …"; exit 0; fi
confirm_teardown() {
  local arg reply
  for arg in "$@"; do
    case "$arg" in
      -y | --yes | --force) return 0 ;;
    esac
  done
  [ -t 0 ] || return 0
  echo "WARNING: this stops the assessment environment and DELETES the local database." >&2
  echo "         All runs, trials, scores, and uploaded recordings are permanently lost." >&2
  read -r -p "Continue? [y/N] " reply
  case "$reply" in
    [Yy] | [Yy][Ee][Ss]) return 0 ;;
    *) return 1 ;;
  esac
}
