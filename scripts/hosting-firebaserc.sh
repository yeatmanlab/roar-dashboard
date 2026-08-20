#!/usr/bin/env bash
# –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– #
# Materialize a local .firebaserc for assessment Hosting targets.
#
# CI generates its own single-project copy inside the deploy-firebase-hosting action, so
# the repository-root .firebaserc is gitignored. Run this to use the Firebase CLI locally
# (firebase deploy --only hosting:roar-pa, firebase hosting:channel:create, ...).
#
# Site IDs are <project-id>-<suffix>; assessment-hosting.json holds only the suffixes, so
# the project IDs are passed in rather than committed.
# –––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––– #

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUFFIX_MAP="${REPO_ROOT}/apps/assessments/hosting-targets.json"
OUTPUT="${REPO_ROOT}/.firebaserc"

usage() {
  cat <<'USAGE'
Usage: npm run hosting:rc -- <staging-project-id> <production-project-id>

Writes a gitignored .firebaserc at the repository root mapping every assessment's Hosting
target to <project-id>-<suffix> under both projects, plus "staging" and "production"
aliases for `firebase use`. There is deliberately no "default" alias, so a bare
`firebase deploy` fails loudly instead of picking a project.

Project IDs are not stored in the repository — read them from your decrypted env config
(VITE_FIREBASE_ADMIN_PROJECT_ID) or from `firebase projects:list`.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 2 ]]; then
  echo "Error: expected 2 project IDs, got $#." >&2
  echo >&2
  usage >&2
  exit 1
fi

STAGING_PROJECT_ID="$1"
PRODUCTION_PROJECT_ID="$2"

if [[ ! -f "$SUFFIX_MAP" ]]; then
  echo "Error: ${SUFFIX_MAP} not found." >&2
  exit 1
fi

jq -n \
  --arg staging "$STAGING_PROJECT_ID" \
  --arg production "$PRODUCTION_PROJECT_ID" \
  --slurpfile suffixes "$SUFFIX_MAP" \
  '($suffixes[0]) as $map
   | {
       projects: { staging: $staging, production: $production },
       targets: {
         ($staging): { hosting: ($map | map_values([$staging + "-" + .])) },
         ($production): { hosting: ($map | map_values([$production + "-" + .])) }
       }
     }' \
  > "$OUTPUT"

echo "Wrote ${OUTPUT} ($(jq -r '.targets | to_entries[0].value.hosting | length' "$OUTPUT") targets per project)."
echo "Select a project with: firebase use staging | firebase use production"
