# Assessment Build, E2E, and Deployment Pipeline

> Local ticket. Prerequisite for versioning (see `1818-assessment-versioning-strategy.md`).
> Scoped from reviewer feedback on PR #1785 (maximilianoertel).

## Goal

Wire up a CI/CD pipeline for monorepo-hosted assessments: E2E tests on PRs, and environment
deployments to staging and production. Leverage existing composite actions and workflow
patterns as closely as possible — assessments are a new app type, not a new infrastructure
paradigm.

PR preview deployments for assessments are out of scope for now and will be added after
deployment and versioning are stable.

## Prerequisites

- PR #1785 merged (roar-pa file migration into monorepo)
- `assessments:staging` and `assessments:production` GitHub environments created with secrets
  (see [#GitHub Environments](#github-environments))

## What Already Exists

These are the building blocks to reuse or adapt:

| Artifact | Location | Purpose |
| -------- | -------- | ------- |
| `build` action | `.github/actions/build/` | Builds the dashboard — model for `build-assessment` |
| `deploy` action | `.github/actions/deploy/` | Firebase Hosting deploy — rename to `deploy-firebase-hosting` |
| `setup-node-environment` action | `.github/actions/setup-node-environment/` | Node + npm install — reuse as-is |
| `deploy-platform-staging.yml` | `.github/workflows/` | Model for `deploy-assessments-staging.yml` |
| `ci.yml` | `.github/workflows/` | Gains assessment change detection, E2E, and preview jobs |
| `firebase.template.json` pattern | `apps/dashboard/firebase/admin/` | Model for per-assessment Firebase config generation |

## Firebase Projects

Assessments deploy to their own Firebase projects, separate from the platform:

| Environment | Firebase project | Status |
| ----------- | ---------------- | ------ |
| development | `gse-roar-assessment-dev` | Being phased out in favour of local development |
| staging | `gse-roar-assessment-staging` | Active |
| production | `gse-roar-assessment` | Active |

`assessments:{env}` GitHub environments therefore carry their own secrets, independent of
`platform:{env}`.

## Implementation

### Step 1 — Rename `deploy` → `deploy-firebase-hosting`

The `deploy` action is platform-specific in name only. Rename it so it can be referenced
clearly from both platform and assessment workflows.

- Rename `.github/actions/deploy/` → `.github/actions/deploy-firebase-hosting/`
- Update `name:` and `description:` in `action.yml`
- Add `dist-path` and `firebase-config-path` inputs to replace the hardcoded dashboard paths
  in the `Prepare deployment` step (currently hardcodes `build/apps/dashboard/dist` and
  `build/apps/dashboard/firebase/admin/firebase.json`)
- Update all existing callers to pass the new inputs explicitly:
  - `.github/workflows/deploy-platform-staging.yml`
  - `.github/workflows/deploy-platform-production.yml`
  - `.github/workflows/deploy-platform-development.yml`

Note: `ci.yml`'s `deploy` job (dashboard preview) is **not touched in this ticket** — PR
previews for assessments are out of scope, and the dashboard preview job can continue using
the action under its old name until a follow-up renames it there too. Alternatively, rename
the caller in `ci.yml` in the same PR to keep things consistent — either is fine, just do it
intentionally.

### Step 2 — Create `build-assessment` composite action

Analogous to the existing `build` action. Builds a single named assessment.

**Location:** `.github/actions/build-assessment/action.yml`

**Inputs:**

| Input | Required | Description |
| ----- | -------- | ----------- |
| `assessment` | yes | Assessment directory name (e.g., `roar-pa`) |
| `build-script` | yes | npm script to run (e.g., `build:staging`, `build:production`) |

**Steps:**
1. Checkout repository (no submodules — assessments are in-tree)
2. Setup Node via `.github/actions/setup-node-environment`
3. Build workspace packages: `npx turbo run build --filter='./packages/*'`
4. Build the assessment: `npm run <build-script> -w apps/assessments/<assessment>`

### Step 3 — Per-assessment Firebase config

Each assessment has a `firebase.json` for Firebase Hosting. Assessments share Firebase
projects (`gse-roar-assessment-staging`, `gse-roar-assessment`) — each project hosts multiple
assessment sites. The target site is declared in the assessment's `package.json` under a
`roar.hosting` field:

```json
"roar": {
  "hosting": {
    "staging": "roar-phoneme-staging",
    "production": "roar-phoneme"
  }
}
```

The deploy workflow reads this with `jq` before deploying and passes it to the
`deploy-firebase-hosting` action as `firebase-hosting-site`. The action injects
`"site": "<site-id>"` into the copied `firebase.json` at deploy time — nothing is committed
beyond the site name (a public URL identifier, not a credential). No `.firebaserc` is needed.

The Firebase project ID (`gse-roar-assessment-staging`, etc.) stays in
`secrets.FIREBASE_PROJECT_ID` in the GitHub Environment and never appears in source.

Adding a new assessment requires only adding the `roar.hosting` field to its `package.json`
with the correct site names — no workflow changes needed.

**CSP headers:** `firebase.json` uses `Content-Security-Policy-Report-Only` only — do not
add an enforcing `Content-Security-Policy` header until the policy has been validated.

### Step 4 — Add assessment jobs to `ci.yml`

Two new jobs gated on change detection: change detection and E2E. No preview deployment.
No standalone assessment CI workflow.

#### `detect-assessment-changes`

```yaml
detect-assessment-changes:
  name: Detect changed assessments
  runs-on: ubuntu-latest
  outputs:
    matrix: ${{ steps.filter.outputs.changes }}
  steps:
    - uses: actions/checkout@v4
    - id: filter
      uses: dorny/paths-filter@v3
      with:
        filters: |
          roar-pa:
            - 'apps/assessments/roar-pa/**'
            - 'apps/assessments/shared/**'
            - 'packages/assessment-sdk/**'
            - 'packages/assessment-schema/**'
```

Adding a new assessment = one new filter block. Changes to `assessment-sdk`,
`assessment-schema`, or `apps/assessments/shared/` trigger all assessments because a change
to shared code could affect any of them.

#### `e2e-assessments`

Runs before preview deployment. Matrix over changed assessments × browsers. All assessments
use port 8000 — matrix jobs run on isolated runners so there is no port conflict.

```yaml
e2e-assessments:
  name: E2E ${{ matrix.assessment }} (${{ matrix.browser }})
  needs: [detect-assessment-changes]
  if: needs.detect-assessment-changes.outputs.matrix != '[]'
  runs-on: ubuntu-latest
  timeout-minutes: 60
  strategy:
    fail-fast: false
    matrix:
      assessment: ${{ fromJson(needs.detect-assessment-changes.outputs.matrix) }}
      browser: [chrome, edge]
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-node-environment
    - name: Build assessment
      uses: ./.github/actions/build-assessment
      with:
        assessment: ${{ matrix.assessment }}
        build-script: build:staging
    - name: Run Cypress tests
      uses: cypress-io/github-action@v6
      with:
        install: false
        start: npm run dev -w apps/assessments/${{ matrix.assessment }}
        browser: ${{ matrix.browser }}
        working-directory: apps/assessments/${{ matrix.assessment }}
        wait-on: 'http://localhost:8000'
        wait-on-timeout: 120
        record: true
        parallel: true
        spec: cypress/e2e/**/*
        ci-build-id: ${{ github.run_id }}-${{ matrix.assessment }}-${{ matrix.browser }}
      env:
        CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Step 5 — `deploy-assessments-staging.yml`

Triggers on push to `main` with path filter on changed assessments and shared packages, and
via `workflow_dispatch` for manual deploys during development and testing.

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'apps/assessments/**'
      - 'packages/assessment-sdk/**'
      - 'packages/assessment-schema/**'
  workflow_dispatch:
    inputs:
      assessment:
        description: 'Assessment to deploy (e.g. roar-pa)'
        required: false
        default: 'roar-pa'
```

When triggered manually, the `assessment` input bypasses change detection and deploys the
specified assessment directly. When triggered by a push, change detection runs as normal.

Mirrors the structure of `deploy-platform-staging.yml` — single `deploy` job with a matrix
over changed assessments.

Environment: `assessments:staging`
Firebase project secret: `FIREBASE_PROJECT_ID` → `gse-roar-assessment-staging`

### Step 6 — `deploy-assessments-production.yml`

**Placeholder trigger:** `workflow_dispatch` for now.

**Long-term trigger:** When the versioning ticket (#1818) adds `roar-pa` to the Release
Please config, `release.yml` will gain a `trigger-assessment-production-deployment` job gated
on `roar_pa_release_created`. That job calls this workflow, replacing the `workflow_dispatch`
placeholder. The two events — npm publish and production deploy — will be coupled so that
what's on npm always matches what's deployed.

Environment: `assessments:production`
Firebase project secret: `FIREBASE_PROJECT_ID` → `gse-roar-assessment`

### Step 7 — GitHub Environments

Create the following GitHub environments in repository settings:

| Environment | Firebase project | Purpose |
| ----------- | ---------------- | ------- |
| `assessments:staging` | `gse-roar-assessment-staging` | PR previews + staging deploys |
| `assessments:production` | `gse-roar-assessment` | Production deploys |

Secrets needed per environment:

| Secret | Required | Purpose |
| ------ | -------- | ------- |
| `FIREBASE_PROJECT_ID` | yes | Firebase project to deploy to |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | yes | OIDC auth for Firebase Hosting deploy |
| `FIREBASE_HOSTING_SERVICE_ACCOUNT_ID` | yes | GCP service account to impersonate |
| `ROAR_API_URL` | yes | Backend base URL, embedded in the bundle at build time via webpack `DefinePlugin`. Used in `serve.js` for all API calls (`POST /v1/users/anonymous`, `GET /v1/tasks/:id/variants`, etc.). |
| `SENTRY_AUTH_TOKEN` | recommended | Uploads source maps to Sentry during the webpack build. Missing it won't fail the build (the plugin has a warn-only `errorHandler`) but error tracking in that environment will lack source maps. |

Note: assessments use plain `dotenv.config()` in the webpack config, not the encrypted
`DOTENV_PRIVATE_KEY` pattern used by platform workflows. There is no env file to unlock.
`ROAR_DB` / `dbmode` is defined in the webpack `DefinePlugin` but not consumed anywhere in
the source — `ROAR_API_URL` is the variable that actually controls which backend the
assessment connects to.

`gse-roar-assessment-dev` is not given a corresponding environment — it is being phased out
in favour of local development.

### Step 8 — Cleanup from PR #1785

Remove artifacts that were checked in as broken or superseded by this ticket:

- `.github/workflows/deploy-assessment.yml` — replaced by `deploy-assessments-{env}.yml`
- `.github/workflows/pr-preview-assessments.yml` — replaced by jobs in `ci.yml`
- `.npmignore` at the assessment level — nothing is being published yet
- Any assessment-related entries added to `deploy-platform-staging.yml` or
  `deploy-platform-production.yml` — platform and assessment deploys are independent

Also address the root `package.json` feedback from Maximilian: turbo should be the only
root-level dependency. All other dependencies belong in the individual app or package
`package.json`.

## Acceptance Criteria

- [ ] `.github/actions/deploy/` renamed to `deploy-firebase-hosting`; accepts `dist-path` and
      `firebase-config-path` inputs; all existing callers updated
- [ ] `.github/actions/build-assessment/` created; builds a named assessment against workspace packages
- [ ] Each assessment has a `firebase/firebase.template.json`; CSP headers in report-only mode
- [ ] `ci.yml` has `detect-assessment-changes` and `e2e-assessments` jobs
- [ ] Adding a new assessment requires only a new `dorny/paths-filter` entry
- [ ] `deploy-assessments-staging.yml` deploys changed assessments on merge to `main`
      to `gse-roar-assessment-staging` via `assessments:staging` environment
- [ ] `deploy-assessments-staging.yml` supports `workflow_dispatch` with an `assessment` input
      for manual deploys
- [ ] `deploy-assessments-production.yml` exists with `workflow_dispatch` trigger placeholder;
      deploys to `gse-roar-assessment` via `assessments:production` environment
- [ ] `assessments:staging` and `assessments:production` GitHub environments created with correct secrets
      (`FIREBASE_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `FIREBASE_HOSTING_SERVICE_ACCOUNT_ID`, `ROAR_API_URL`, `SENTRY_AUTH_TOKEN`)
- [ ] Broken/superseded artifacts from PR #1785 removed
- [ ] Root `package.json` contains only turbo as a dependency

## Related

- PR #1785 — Initial monorepo migration (base for this work)
- `tickets/1818-assessment-versioning-strategy.md` — npm publishing (depends on this ticket)
- `apps/dashboard/firebase/admin/` — reference implementation for firebase.template.json
- `.github/actions/build/action.yml` — reference implementation for build-assessment
- `.github/workflows/deploy-platform-staging.yml` — reference implementation for deploy-assessments-staging
- `.release-please.json` — Release Please config (roar-pa added here in versioning ticket)
- `.github/workflows/release.yml` — gains `trigger-assessment-production-deployment` job in versioning ticket
