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

# What to do when the ephemeral Postgres host port is already taken. A stale
# assessment container is the usual cause now that the default is 5433, not 5432.
print_port_in_use_help() {
  echo "  Find what is holding port $ASSESSMENT_PG_PORT and stop it:" >&2
  echo "    macOS: lsof -i :$ASSESSMENT_PG_PORT      Linux: ss -tlnp | grep :$ASSESSMENT_PG_PORT" >&2
  echo "  A leftover assessment container is the usual cause: docker ps | grep $ASSESSMENT_PG_PORT" >&2
  echo "  Or pick another port: ASSESSMENT_PG_PORT=<port> npm start" >&2
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
