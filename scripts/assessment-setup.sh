#!/usr/bin/env bash
# assessment-setup.sh — First-run setup for the local assessment environment.
#
# Run once from an assessment directory before your first `npm start`. It:
#   1. Checks the Node.js version meets the repo's engines floor — npm only
#      warns (EBADENGINE) and continues, and the eventual failure on old Node
#      is an unrelated-looking build error.
#   2. Checks Docker (Compose v2) is available and the daemon is running —
#      warns with install/launch options if not.
#   3. Checks every host port the stack binds (STACK_PORTS: Postgres on
#      ASSESSMENT_PG_PORT, the Firebase emulators, the backend) is free — warns
#      with a per-port diagnosis if not.
#   4. Installs dependencies and builds the platform libraries from the repo root.
#   5. Creates taskVariantParameters.json from the example (never clobbers an
#      existing one).
#   6. Points you at the documentation and the next command.
#
# Docker availability and the host ports are checked but NOT required to finish
# setup — neither is needed for the install/build/copy steps. Any blocker is
# collected and re-printed at the end so it is resolved before `npm start`.
#
# Usage (from any assessment package.json):
#   "setup": "bash ../../../scripts/assessment-setup.sh"
set -euo pipefail

# Shared context (REPO_ROOT, ASSESSMENT_DIR, ASSESSMENT_NAME, PARAMS_FILE) and
# pre-flight checks. See assessment-common.sh.
source "$(cd "$(dirname "$0")" && pwd)/assessment-common.sh"

# Blockers that don't stop setup but must be resolved before `npm start`.
warnings=()

echo "=== Setting up the assessment environment for \"$ASSESSMENT_NAME\" ==="
echo

# ── 1. Node.js version ───────────────────────────────────────────────────────
# Must match the "engines" floor in the root package.json.
NODE_MAJOR_FLOOR=22
echo "[1/5] Checking the Node.js version (need ${NODE_MAJOR_FLOOR}+)..."
# || true: a missing node must reach the warning below, not abort via set -e.
node_major="$(node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1 || true)"
if [ -n "$node_major" ] && [ "$node_major" -ge "$NODE_MAJOR_FLOOR" ]; then
  echo "  Found Node $(node --version)."
else
  echo "  Node ${NODE_MAJOR_FLOOR}+ is required (found: $(node --version 2>/dev/null || echo 'none'))." >&2
  echo "  Install it from https://nodejs.org, or: brew install node@${NODE_MAJOR_FLOOR} (macOS) / nvm install ${NODE_MAJOR_FLOOR}" >&2
  warnings+=("Install Node ${NODE_MAJOR_FLOOR}+ and re-run 'npm run setup'.")
fi
echo

# ── 2. Docker ────────────────────────────────────────────────────────────────
echo "[2/5] Checking Docker (Compose v2)..."
if ! docker_compose_available; then
  echo "  Docker with Compose v2 was not found." >&2
  print_docker_install_help
  warnings+=("Install Docker (Compose v2) before running 'npm start'.")
elif ! docker_daemon_running; then
  echo "  Docker is installed but not running." >&2
  print_docker_daemon_help
  warnings+=("Start Docker before running 'npm start'.")
else
  echo "  Found Docker with Compose v2 (daemon running)."
fi
echo

# ── 3. Stack host ports ──────────────────────────────────────────────────────
# Advisory only: `npm start` force-removes stale assessment containers before
# its own (hard) port check, so a clash from a leftover assessment run resolves
# itself — but a running platform stack or local process won't.
echo "[3/5] Checking that the stack's host ports are free (Postgres $ASSESSMENT_PG_PORT, emulators 9099/9199/9000, backend 4000)..."
busy_ports=()
for port in "${STACK_PORTS[@]}"; do
  if port_in_use "$port"; then
    echo "  Port $port is already in use." >&2
    diagnose_port_conflict "$port"
    busy_ports+=("$port")
  fi
done
if [ ${#busy_ports[@]} -gt 0 ]; then
  warnings+=("Free the port(s) listed above (${busy_ports[*]}) before running 'npm start'.")
else
  echo "  All ports are free."
fi
echo

# ── 4. Install + build platform libraries ────────────────────────────────────
# The assessment dev server bundles these workspace libraries from their built
# dist/. A filtered build (rather than a full `turbo run build` of the dashboard
# and every assessment) keeps first-run fast and resilient to unrelated
# breakage; `dependsOn: ["^build"]` still pulls in their upstream dependencies.
echo "[4/5] Installing dependencies and building platform libraries (this can take a few minutes)..."
cd "$REPO_ROOT"
"${NPM_CLI[@]}" install
"${NPM_CLI[@]}" run build -- \
  --filter=@roar-platform/api-contract \
  --filter=@roar-platform/assessment-schema \
  --filter=@roar-platform/scoring-tables \
  --filter=@roar-platform/assessment-sdk
cd "$ASSESSMENT_DIR"
echo "  Dependencies installed and platform libraries built."
echo

# ── 5. taskVariantParameters.json ────────────────────────────────────────────
echo "[5/5] Setting up taskVariantParameters.json..."
if [ -f "$PARAMS_FILE" ]; then
  echo "  taskVariantParameters.json already exists — leaving it untouched."
elif [ -f "$ASSESSMENT_DIR/taskVariantParameters.example.json" ]; then
  cp "$ASSESSMENT_DIR/taskVariantParameters.example.json" "$PARAMS_FILE"
  echo "  Created taskVariantParameters.json from the example."
else
  echo "  Warning: no taskVariantParameters.example.json found in $ASSESSMENT_DIR." >&2
  warnings+=("Create taskVariantParameters.json manually before running 'npm start'.")
fi
echo

# ── Summary ──────────────────────────────────────────────────────────────────
echo "=== Setup complete ==="
if [ ${#warnings[@]} -gt 0 ]; then
  echo
  echo "Resolve these before running 'npm start':"
  for w in "${warnings[@]}"; do
    echo "  - $w"
  done
fi
echo
echo "Next steps:"
echo "  - Start the environment:      npm start"
echo "  - Setup & script reference:   apps/assessments/ASSESSMENT_ENVIRONMENT.md"
echo "  - Research loop & queries:    apps/assessments/ASSESSMENT_RESEARCH_GUIDE.md"
