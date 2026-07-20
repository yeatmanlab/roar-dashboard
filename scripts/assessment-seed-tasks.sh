#!/usr/bin/env bash
# assessment-seed-tasks.sh — Seed newly added task variants into the *already
# running* environment, without tearing anything down.
#
# The normal task/variant seed runs once, inside the assessment-db-migrate
# container, at environment bring-up. That container does not re-run on
# `npm start` when the stack is already up, and `npm restart` / `npm stop`
# wipe the database volume — and with it every run, trial, and score you have
# generated. This script closes that gap: it runs the same idempotent,
# additive-by-name seeder from the host against the live container database, so
# a newly added variant in taskVariantParameters.json appears immediately while
# your generated data is left untouched.
#
# Usage (from any assessment package.json):
#   "seed:tasks": "bash ../../../scripts/assessment-seed-tasks.sh"
set -euo pipefail

# Shared context (REPO_ROOT, ASSESSMENT_NAME, PARAMS_FILE) and pre-flight
# checks. See assessment-common.sh.
source "$(cd "$(dirname "$0")" && pwd)/assessment-common.sh"

if [ ! -f "$PARAMS_FILE" ]; then
  print_params_file_missing_help
  exit 1
fi

# The seeder connects to the container's published Postgres port — if the stack
# isn't up there is nothing to seed into. Point the user at `npm start`.
if ! assessment_container_running assessment-db; then
  echo "Error: the assessment environment is not running (assessment-db container not found)." >&2
  echo "  Start it first, then re-run this command:" >&2
  echo "    npm start" >&2
  exit 1
fi

echo "Seeding task variants for \"$ASSESSMENT_NAME\" from taskVariantParameters.json..."
echo "Existing tasks, variants, and generated run data are left untouched (seeding is additive by name)."
echo

# Run the same seeder the migrate container uses, but from the host against the
# live database. Inline env vars take precedence over apps/backend/.env
# (dotenv does not override already-set variables), so this targets the
# container DB regardless of local backend config.
cd "$REPO_ROOT"
CORE_DATABASE_URL="postgres://postgres@localhost:${ASSESSMENT_PG_PORT}/roar_core" \
TASK_VARIANT_PARAMETERS_FILE="$PARAMS_FILE" \
  "${NPM_CLI[@]}" run dev:seed:tasks -w apps/backend -- --task "$ASSESSMENT_NAME"

echo
echo "Done. Reload the assessment (or use the variant picker) to see the new variants."
