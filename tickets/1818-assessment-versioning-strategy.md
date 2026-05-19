# Independent Package Versioning for Published Assessments

> Local working copy of [roar-project-management#1818](https://github.com/yeatmanlab/roar-project-management/issues/1818).
> Updated with decisions from design discussions — see conversation history for full context.

## Prerequisites

**Do not open the versioning PR until both are complete:**

1. **Phase 5 (researcher developer environment)** — Docker Compose, Postgres, and seed scripts must be working. A researcher needs to be able to run an assessment locally against the monorepo before versioning and publishing is meaningful.
2. **Assessment deployment pipeline** (`tickets/assessment-deployment-ci-cd.md`) — the build pipeline, Firebase Hosting config, and staging deploy must be proven before the first npm publish. Versioning should not be the first time we discover the build output is wrong.

## Background

The initial monorepo migration kept all packages internal. This ticket implements independent versioning and npm publishing for the assessment packages.

Release Please is already configured in the repo (`.release-please.json`, `.release-please-manifest.json`, `release.yml`) with `assessment-sdk` as an independent package and the `linked-versions` plugin locking `backend` + `dashboard` together. The changes in this ticket are **additive** — no tool migration, no rewrite of `release.yml`.

**Workspace references do not need to be replaced with npm references in source code.** Release Please updates `package.json` version fields at release time. Developers in the monorepo always get the local workspace copy; external consumers installing from npm get a properly pinned version.

## Packages to Publish

All three packages must be published to **public npm**. The assessments have direct `dependencies` on `assessment-schema` and `assessment-sdk` — npm resolves these at install time, so if either dependency is not on public npm, external researcher installs will fail.

| Package | npm name |
| ------- | -------- |
| `packages/assessment-schema` | `@roar-platform/assessment-schema` |
| `packages/assessment-sdk` | `@roar-platform/assessment-sdk` |
| `apps/assessments/roar-pa` | `@roar-platform/roar-pa` |

Each subsequent assessment migrated into the monorepo adds its own entry and follows the same pattern.

## The Role of `assessment-sdk`

`assessment-sdk` has two distinct consumer groups:

1. **The assessments themselves** — internal consumers that use it to write trials, start runs, etc.
2. **External dashboard authors** — partner labs and research groups who integrate ROAR assessments into their own dashboards and depend on `assessment-sdk` as an integration surface.

The package was originally designed for the first use case and later adopted by the second. Its public API surface is currently implicit, derived from the interface of its predecessor `roar-firekit`, for which it provides a built-in compat layer (`src/compat/firekit.ts`).

At least one partner integration works by supplying a Firebase config that `roar-firekit` uses to establish the backend connection. These partners can continue using the existing `@bdelab/*` packages on npm until they are ready to migrate. The old packages will remain live — they are not yanked, only deprecated.

Before the first `@roar-platform/assessment-sdk` stable release, the public API surface should be made explicit: audit what `index.ts` exports, verify the compat layer fully covers the `roar-firekit` integration pattern, and document the intended entry points. The `roar-firekit` interface is the starting point for this, as it represents the de facto public contract that existing integrations are built against.

## Implementation (single PR, `refactor/`)

Everything below lands in one PR. Deprecation is the only follow-up step.

### Remove the PR #1675 scaffold

PR #1675 (merged) introduced:
- `publish-assessment-sdk.yml` — publishes `@yeatmanlab/assessment-sdk` to GitHub Package Registry on every push to `main`
- Package name: `@yeatmanlab/assessment-sdk`

Both must be removed. The workflow conflicts with Release Please controlling the publish cadence, and the package name conflicts with the target `@roar-platform/assessment-sdk`.

### Package renames and import updates

Rename all packages in one pass:
- `@roar-dashboard/*` → `@roar-platform/*` across all `package.json` files
- `@yeatmanlab/assessment-sdk` → `@roar-platform/assessment-sdk`
- Update all import statements across the monorepo source files (mechanical find-and-replace)

If the diff becomes hard to review, split the import rename into its own commit within the PR.

### Package.json updates

For each publishable package:
- Remove `"private": true`
- Add `"publishConfig": { "access": "public" }`
- Verify `"files"`, `"main"`, `"module"`, and `"exports"` point to the correct `dist/` output paths
- Verify `roar-pa` declares `assessment-sdk` and `assessment-schema` as workspace protocol
  dependencies (`"workspace:*"`) — required for the cascade plugin to work

### Release Please config updates (`.release-please.json`)

Add the `node-workspace` plugin alongside the existing `linked-versions` plugin. The
`node-workspace` plugin reads workspace protocol dependencies and automatically queues a patch
bump on `roar-pa` whenever `assessment-sdk` or `assessment-schema` releases — this is the
cascade behavior:

```json
"plugins": [
  {
    "type": "linked-versions",
    "groupName": "platform",
    "components": ["backend", "dashboard"]
  },
  {
    "type": "node-workspace"
  }
]
```

Add the new packages to `"packages"`:

```json
"packages/assessment-schema": {
  "changelog-path": "CHANGELOG.md",
  "version-file": "package.json",
  "release-type": "node",
  "component": "assessment-schema"
},
"apps/assessments/roar-pa": {
  "changelog-path": "CHANGELOG.md",
  "version-file": "package.json",
  "release-type": "node",
  "component": "roar-pa"
}
```

### Release manifest update (`.release-please-manifest.json`)

Add initial versions for the new packages:

```json
"packages/assessment-schema": "0.1.0",
"apps/assessments/roar-pa": "0.1.0"
```

### `release.yml` updates (additive only)

Add output flags for the new components to the `release-please` job:

```yaml
roar_pa_release_created: ${{ steps.release.outputs.roar-pa--release_created }}
assessment_schema_release_created: ${{ steps.release.outputs.assessment-schema--release_created }}
```

Add a new `publish-assessment-packages` job gated on any assessment release:

```yaml
publish-assessment-packages:
  name: Publish assessment packages to npm
  needs: release-please
  if: |
    needs.release-please.outputs.roar_pa_release_created == 'true' ||
    needs.release-please.outputs.assessment_sdk_release_created == 'true' ||
    needs.release-please.outputs.assessment_schema_release_created == 'true'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-node-environment
    - name: Setup Node.js for npm publish
      uses: actions/setup-node@v4
      with:
        node-version-file: '.nvmrc'
        registry-url: 'https://registry.npmjs.org'
    - name: Build packages
      run: npx turbo run build --filter='./packages/*'
    - name: Publish to npm
      run: |
        [ "${{ needs.release-please.outputs.assessment_schema_release_created }}" == "true" ] && npm publish -w packages/assessment-schema --provenance || true
        [ "${{ needs.release-please.outputs.assessment_sdk_release_created }}" == "true" ] && npm publish -w packages/assessment-sdk --provenance || true
        [ "${{ needs.release-please.outputs.roar_pa_release_created }}" == "true" ] && npm publish -w apps/assessments/roar-pa --provenance || true
      env:
        NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # replaced by OIDC — see note
```

> **Note on OIDC trusted publishing:** Replace `NODE_AUTH_TOKEN` with OIDC authentication
> (`id-token: write` permission + `--provenance`) once npm trusted publishing is configured
> for the `@roar-platform` scope. This removes the need for any stored npm token.

Add a `trigger-assessment-production-deployment` job gated on `roar_pa_release_created`,
replacing the `workflow_dispatch` placeholder in `deploy-assessments-production.yml`:

```yaml
trigger-assessment-production-deployment:
  name: Trigger Assessment Production Deployment
  needs: [release-please, publish-assessment-packages]
  if: needs.release-please.outputs.roar_pa_release_created == 'true'
  uses: ./.github/workflows/deploy-assessments-production.yml
  secrets: inherit
```

This mirrors the existing `trigger-platform-deployment` job pattern exactly.

## Developer Workflow

No change from the current workflow. Contributors write conventional commits (`feat:`, `fix:`,
`chore:`) scoped to the package they changed. Release Please reads these and determines the
appropriate version bump. No extra tooling step required.

For assessment-specific commits, scope to the component:
```
fix(roar-pa): correct trial submission timing
feat(assessment-sdk): add retry on network timeout
```

## Cascade Behavior

Because `roar-pa` declares `assessment-sdk` and `assessment-schema` as `workspace:*`
dependencies and the `node-workspace` plugin is active, a release of either package
automatically queues a patch bump on `roar-pa` in the next Release Please PR. No manual
action needed.

If a change to `assessment-sdk` warrants a minor or major bump on `roar-pa` beyond the
automatic patch, contributors include an explicit conventional commit scoped to `roar-pa`
in the same PR — Release Please takes the higher of the two.

Given that `assessment-sdk` has external dashboard authors as consumers, breaking changes to
its public API should always carry a `feat!:` or `fix!:` commit to trigger a major bump.

## Deprecation (follow-up, after first publish)

Once `@roar-platform/roar-pa` is published and stable, deprecate the original packages.
**Do not run until the first release is live on npm and affected partners have been notified
directly.** Old packages are not yanked.

```
npm deprecate @bdelab/roar-pa@"*" "Deprecated: migrated to @roar-platform/roar-pa. See migration guide: https://github.com/yeatmanlab/roar-dashboard"
```

## Acceptance Criteria

- [ ] Assessment deployment pipeline complete and proven before this PR opens
- [ ] `publish-assessment-sdk.yml` removed; `@yeatmanlab/assessment-sdk` gone from GitHub Packages
- [ ] All packages renamed `@roar-dashboard/*` / `@yeatmanlab/*` → `@roar-platform/*`
- [ ] All import statements updated across the monorepo
- [ ] `node-workspace` plugin added to `.release-please.json`
- [ ] `assessment-schema` and `roar-pa` added to `.release-please.json` and `.release-please-manifest.json`
- [ ] `roar-pa` declares `assessment-sdk` and `assessment-schema` as `workspace:*` dependencies
- [ ] All publishable packages have `"publishConfig": { "access": "public" }` and no `"private": true`
- [ ] `release.yml` has `publish-assessment-packages` job publishing to npm with provenance
- [ ] `release.yml` has `trigger-assessment-production-deployment` job; production deploy and npm publish are always in sync
- [ ] Internal packages (`apps/backend`, `apps/dashboard`, `apps/drizzle`) excluded from publishing
- [ ] Patch bump to `assessment-sdk` or `assessment-schema` automatically cascades to `roar-pa`
- [ ] `assessment-sdk` public API surface made explicit before first stable publish
- [ ] `@bdelab/roar-pa` deprecated on npm after first release, after partner notification

## Out of Scope

- Migration guides for external dashboard authors — deferred until packages are live and stable
- Versioning for assessments beyond `roar-pa` — each subsequent migration adds a package entry and follows the same pattern
- Linked versioning across all assessments — assessments version independently
- Pre-release (`alpha`/`beta`) channels — addable later via Release Please config

## Related

- [roar-project-management#1662](https://github.com/yeatmanlab/roar-project-management/issues/1662) — Researcher local development strategy
- [roar-dashboard#1675](https://github.com/yeatmanlab/roar-dashboard/pull/1675) — Interim SDK publishing scaffold (to be removed)
- `tickets/assessment-deployment-ci-cd.md` — Deployment pipeline (prerequisite)
- `.release-please.json` — existing Release Please config
- `.release-please-manifest.json` — existing version manifest
- `.github/workflows/release.yml` — existing release workflow (additive changes only)
