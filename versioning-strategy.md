# Independent Package Versioning for Published Assessments

Follows the monorepo migration exemplar (`monorepo-example.md`). This ticket wires up automated versioning and npm publishing for packages that external consumers depend on.

## Prerequisites and Sequencing

**Do not implement versioning until the researcher developer environment is proven.** Phase 5 (researcher local dev environment with Docker Compose, Postgres, and seed scripts) must be working first. A researcher needs to be able to run an assessment locally against the monorepo before versioning and publishing that assessment is meaningful.

Once Phase 5 is validated, implement in this order:

1. **Changesets infrastructure** (bot + Version Packages PR workflow) — using current `@roar-dashboard/*` package names. No npm publish step yet.
2. **Rename PR** (`refactor/`) — rename all packages `@roar-dashboard/*` → `@roar-platform/*`. Add the npm publish step to the release workflow in this PR. First actual npm publish happens here.
3. **Deprecate `@bdelab/roar-pa`** — once `@roar-platform/roar-pa` is live on npm (see Phase 4 below).

This order ensures external researchers never see `@roar-dashboard/roar-pa` on npm — they go directly from `@bdelab/roar-pa` to `@roar-platform/roar-pa`.

## Summary

The initial monorepo migration (Option A) keeps all packages internal. This ticket implements Option B: independent versioning and npm publishing for `@roar-platform/roar-pa`, `@roar-platform/assessment-schema`, and `@roar-platform/assessment-sdk` using Changesets.

## Packages to Publish

All three packages publish independently — assessments cannot function without `assessment-schema` and `assessment-sdk`, so all three need to be versioned and available on npm:

| Package | npm name |
| ------- | -------- |
| `packages/assessment-schema` | `@roar-platform/assessment-schema` |
| `packages/assessment-sdk` | `@roar-platform/assessment-sdk` |
| `apps/assessments/roar-pa` | `@roar-platform/roar-pa` |

Each subsequent assessment migrated into the monorepo adds its own entry here.

## Implementation

### Phase 1: Changesets Setup

1. Install `@changesets/cli` at the monorepo root:
   ```
   npm install -D @changesets/cli -w .
   npx changeset init
   ```
2. Configure `.changeset/config.json`:
   - Set `"access": "public"` for all scoped packages
   - Set `"updateInternalDependencies": "patch"` so that a release of `assessment-schema` or `assessment-sdk` automatically triggers a patch bump on `roar-pa` (and any other dependent assessment). This keeps published versions honest about what they actually contain.
   - List publishable packages explicitly; internal-only packages (e.g., `apps/backend`, `apps/dashboard`) should be marked `"private": true` and excluded.

### Phase 2: Package.json Updates

For each publishable package:
- Remove `"private": true` (or set to `false`)
- Add `"publishConfig": { "access": "public" }`
- Verify `"files"`, `"main"`, `"module"`, and `"exports"` point to the correct `dist/` output paths
- Verify internal dependencies use the workspace protocol (`"*"` or `"workspace:*"`) — Changesets replaces these with resolved version numbers at publish time

### Phase 3: CI/CD Workflows

Add two GitHub Actions workflows:

**Changeset bot** (`.github/workflows/changeset-bot.yml`):
- Runs on every PR
- Comments if a PR touches a publishable package but includes no changeset file, reminding contributors to document the change

**Release workflow** (`.github/workflows/release.yml`):
- Triggers on merge to `main`
- Opens a "Version Packages" PR that aggregates all pending changeset files into version bumps and changelog entries
- When the "Version Packages" PR is merged, publishes updated packages to npm using [npm trusted publishing](https://docs.npmjs.com/generating-provenance-statements) (OIDC-based, no stored npm token required)
- Configure the workflow with `id-token: write` permission and pass `--provenance` to `npm publish` for supply chain transparency

### Phase 4: Deprecate the Old Package

Once `@roar-platform/roar-pa` is published and stable, deprecate the original package with a 6-month migration window. The external user base is small, making this transition manageable.

```
npm deprecate @bdelab/roar-pa@"*" "Deprecated: migrated to @roar-platform/roar-pa. Please update your dependency. Support ends [6 months from publish date]. See: https://github.com/yeatmanlab/roar-dashboard"
```

> **Note:** Do not run this until the first `@roar-platform/roar-pa` release is live on npm and researchers have been notified directly.

## Developer Workflow

When making a change to a publishable package, contributors run:

```
npx changeset
```

The interactive prompt asks which packages changed and whether the change is a patch, minor, or major. The resulting changeset file commits alongside the PR. On merge, Changesets aggregates all pending changesets into a version bump PR automatically.

## Internal Dependency Bump Behavior

Because `updateInternalDependencies` is set to `"patch"`, a release of `assessment-schema` or `assessment-sdk` will automatically produce a patch bump on `roar-pa` (and any other assessment that depends on them) without a manual changeset entry. This ensures that published assessment versions always reflect their actual internal dependency versions.

If a change to `assessment-schema` warrants a minor or major bump on `roar-pa`, contributors include an explicit changeset for `roar-pa` describing the impact — Changesets takes the higher of the two.

## Acceptance Criteria

- [ ] `@changesets/cli` is installed and `.changeset/config.json` is configured
- [ ] All publishable packages have `"publishConfig": { "access": "public" }` and no `"private": true`
- [ ] Changeset bot comments on PRs that touch publishable packages without a changeset
- [ ] Merging a "Version Packages" PR publishes updated packages to npm automatically via trusted publishing (OIDC, no stored token)
- [ ] Published packages include provenance statements (`--provenance`)
- [ ] Internal packages (`apps/backend`, `apps/dashboard`, `apps/drizzle`) are excluded from publishing
- [ ] A patch bump to `assessment-schema` or `assessment-sdk` automatically produces a patch bump on `roar-pa`
- [ ] `@bdelab/roar-pa` is deprecated on npm after the first `@roar-platform/roar-pa` release

## Out of Scope

- Versioning strategy for assessments beyond `roar-pa` — each subsequent assessment migration adds its row to the package table above and follows the same pattern
- A Changesets `linked` configuration to lock all assessment versions together — assessments version independently for now
- Pre-release (`alpha`/`beta`) channels — can be added to the Changesets config later if needed

## Related Issues

- Monorepo migration exemplar (`monorepo-example.md`)
- [Researcher local development strategy](https://github.com/yeatmanlab/roar-project-management/issues/1662)
