#!/usr/bin/env bash
# assessment-restart.sh — Restart the assessment environment from scratch: tear it
# down (deleting the local database) and bring it back up.
#
# Unlike a plain `npm run stop && npm run start`, this confirms the destructive
# teardown ONCE and, on decline, aborts cleanly — nothing is torn down, nothing is
# started, and it exits 0 so npm prints no "lifecycle script failed" noise.
#
# Usage (from any assessment package.json):
#   "restart": "bash ../../../scripts/assessment-restart.sh"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Shared context + confirm_teardown. See assessment-common.sh.
source "$SCRIPT_DIR/assessment-common.sh"

# Confirm the wipe once (skipped on a non-TTY or with -y/--yes). Declining changes
# nothing — no teardown, no start — and exits 0 so it isn't flagged as a failure.
if ! confirm_teardown "$@"; then
  echo "Aborted — nothing changed; the environment is untouched and your data is intact." >&2
  exit 0
fi

# Already confirmed: tear down without re-prompting, then start. `exec` so this
# process becomes the dev server, matching `npm start`.
bash "$SCRIPT_DIR/assessment-env-down.sh" --yes
exec bash "$SCRIPT_DIR/assessment-env-up.sh"
