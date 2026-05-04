# Release Process for ROAR Dashboard

This document describes the release process for the ROAR Dashboard monorepo using Release Please for automated versioning and changelog generation.

## Overview

We use **Release Please** to automate versioning, changelog generation, and GitHub release creation. The process is triggered automatically when PRs are merged to `main` with conventional commit titles.

### Release Strategy

The monorepo uses **hybrid versioning**:

| Package | Versioning | Scope |
|---------|-----------|-------|
| backend | Shared (platform) | `apps/backend` |
| dashboard | Shared (platform) | `apps/dashboard` |
| api-contract | Shared (platform) | `packages/api-contract` |
| assessment-sdk | Independent | `packages/assessment-sdk` |

**Platform Release**: When backend, dashboard, or api-contract changes are released, they share a single version number (e.g., `3.26.0`).

**SDK Release**: Assessment SDK is versioned independently (e.g., `0.1.0`) and can be released separately.

## Workflow

### 1. Create a PR with Conventional Commit Title

All PRs must have a clear, conventional commit title that describes the user-facing impact:

```
feat(backend): add user creation endpoint
fix(dashboard): resolve navigation bug
refactor(api-contract): simplify error handling
docs(sdk): update integration guide
```

**Conventional Commit Format**: `<type>(<scope>): <description>`

**Types**:
- `feat` → Features (triggers minor version bump)
- `fix` → Bug Fixes (triggers patch version bump)
- `refactor` → Refactoring (included in changelog, no version bump)
- `perf` → Performance improvements (included in changelog, no version bump)
- `docs` → Documentation (no version bump)
- `chore` → Miscellaneous (no version bump)

**Scopes** (optional but recommended):
- `backend` - Backend API service
- `dashboard` - Frontend dashboard
- `api-contract` - Shared API contract
- `sdk` - Assessment SDK
- `infra` - Infrastructure/CI/CD

**Examples**:
```
feat(backend): add user creation endpoint
fix(dashboard): resolve navigation bug in class view
refactor(api-contract): simplify error response structure
docs: update contributing guidelines
chore(deps): upgrade TypeScript to 5.10
```

### 2. Merge PR to Main

When you merge a PR to `main` using **squash merge**, the commit title becomes the commit message. This is what Release Please reads.

**Important**: Use squash merge to ensure clean commit history and proper Release Please parsing.

### 3. Release Please Creates Release PR

Release Please automatically:
1. Detects conventional commits since the last release
2. Determines version bumps for each package
3. Generates/updates `CHANGELOG.md` files
4. Creates a Release PR with all changes

**Release PR Title**: `chore: release 3.26.0` (or similar)

**Release PR includes**:
- Updated `package.json` versions
- Updated `CHANGELOG.md` files for each package
- Summary of changes by package

### 4. Review and Approve Release PR

**Gate 1: Release PR Approval**

Required reviewers:
- QA Lead (verify changelog accuracy)
- Tech Lead (verify version bumps are appropriate)

The Release PR should be reviewed like any other PR:
- Verify changelog entries are accurate
- Verify version bumps match the changes
- Verify no unintended packages were bumped

### 5. Merge Release PR

When the Release PR is merged to `main`:
1. Release Please automatically creates git tags for each released package
2. GitHub Releases are created with the changelog content
3. Tags trigger the production deployment workflow

**Tags created** (example for version 3.26.0):
- `backend-v3.26.0` - Backend release
- `dashboard-v3.26.0` - Dashboard release
- `api-contract-v3.26.0` - API contract release
- `assessment-sdk-v0.1.0` - SDK release (independent version)

### 6. Production Deployment

When tags are pushed, the `deploy-platform-production.yml` workflow is triggered.

**Gate 2: Production Deployment Approval**

Required reviewers:
- Tech Lead (verify deployment readiness)
- Product Owner (final sign-off)

The deployment workflow:
1. Verifies tags are on `main`
2. Builds backend Docker image
3. Runs database migrations
4. Deploys backend to Cloud Run
5. Deploys frontend to Firebase Hosting

## Approval Gates

### Gate 1: Release PR (QA + Tech Lead)

**When**: After Release Please creates the Release PR
**Who**: QA Lead + Tech Lead
**What**: Review changelog accuracy and version bumps

**Checklist**:
- [ ] Changelog entries are accurate
- [ ] Version bumps are appropriate (major/minor/patch)
- [ ] No unintended packages were bumped
- [ ] Breaking changes are clearly documented

### Gate 2: Production Deployment (Tech Lead + Product Owner)

**When**: After Release PR is merged and tags are created
**Who**: Tech Lead + Product Owner
**What**: Final approval before production deployment

**Checklist**:
- [ ] All tests pass in CI
- [ ] Staging deployment is successful
- [ ] No critical issues in staging
- [ ] Product Owner approves the release

## Environments

### Staging Deployment
- Triggered automatically on commits to `main`
- No approval required
- Used for QA testing before production

### Production Deployment
- Triggered by tag push (Release PR merge)
- **Requires approval** from Tech Lead + Product Owner
- Environment: `platform:production`

## Changelog Structure

Release Please generates per-package changelogs:

- `apps/backend/CHANGELOG.md` - Backend changes
- `apps/dashboard/CHANGELOG.md` - Dashboard changes
- `packages/api-contract/CHANGELOG.md` - API contract changes
- `packages/assessment-sdk/CHANGELOG.md` - SDK changes

**GitHub Releases** serve as the platform-level summary. Each GitHub Release includes:
- All packages released in that version
- Combined changelog from all packages
- Links to individual package changelogs

## Examples

### Example 1: Feature Release

**Scenario**: You add a new user creation endpoint to the backend.

1. Create PR with title: `feat(backend): add user creation endpoint`
2. Merge to `main` using squash merge
3. Release Please detects the `feat` commit
4. Release Please creates Release PR:
   - Backend version: `3.26.0` → `3.27.0` (minor bump)
   - Dashboard version: unchanged (no changes)
   - API contract version: unchanged (no changes)
   - SDK version: unchanged (no changes)
5. Review and merge Release PR
6. Tags created: `backend-v3.27.0`
7. Production deployment triggered (requires approval)

### Example 2: Bug Fix Release

**Scenario**: You fix a bug in the dashboard navigation.

1. Create PR with title: `fix(dashboard): resolve navigation bug`
2. Merge to `main` using squash merge
3. Release Please detects the `fix` commit
4. Release Please creates Release PR:
   - Backend version: unchanged
   - Dashboard version: `3.26.0` → `3.26.1` (patch bump)
   - API contract version: unchanged
   - SDK version: unchanged
5. Review and merge Release PR
6. Tags created: `dashboard-v3.26.1`
7. Production deployment triggered (requires approval)

### Example 3: SDK Release

**Scenario**: You add a new feature to the assessment SDK.

1. Create PR with title: `feat(sdk): add new data export method`
2. Merge to `main` using squash merge
3. Release Please detects the `feat` commit
4. Release Please creates Release PR:
   - Backend version: unchanged
   - Dashboard version: unchanged
   - API contract version: unchanged
   - SDK version: `0.1.0` → `0.2.0` (minor bump)
5. Review and merge Release PR
6. Tags created: `assessment-sdk-v0.2.0`
7. SDK publishing workflow triggered (independent from platform deployment)

### Example 4: Multi-Package Release

**Scenario**: You update the API contract AND create separate PRs for backend and dashboard to use it.

1. Create PR #1 with title: `feat(api-contract): add new user fields` → merge
2. Create PR #2 with title: `feat(backend): use new user fields` → merge
3. Create PR #3 with title: `feat(dashboard): use new user fields` → merge
4. Release Please creates Release PR with:
   - Backend version: `3.26.0` → `3.27.0` (minor bump, has feat commit)
   - Dashboard version: `3.26.0` → `3.27.0` (minor bump, has feat commit)
   - API contract version: `3.26.0` → `3.27.0` (minor bump, has feat commit)
   - SDK version: unchanged
5. Review and merge Release PR
6. Tags created: `backend-v3.27.0`, `dashboard-v3.27.0`, `api-contract-v3.27.0`
7. Production deployment triggered (requires approval)

**Note**: Release Please does NOT track dependencies between packages. Each package is bumped independently based on its own conventional commits. If only the API contract changes (no backend/dashboard commits), only the API contract version is bumped.

## Troubleshooting

### Release Please Didn't Create a Release PR

**Possible causes**:
1. PR was merged with a merge commit instead of squash merge
2. Commit message doesn't follow conventional commit format
3. Changes are only in docs or chore (no version bump)

**Solution**: Check the commit message in `main` branch:
```bash
git log --oneline -5
```

Verify it follows the format: `type(scope): description`

### Wrong Version Bump

**Possible causes**:
1. Commit type is wrong (e.g., `fix` instead of `feat`)
2. Multiple commits were squashed with inconsistent types

**Solution**: 
1. Check the Release PR to see what Release Please detected
2. If incorrect, close the Release PR and fix the commit message
3. Force push the corrected commit (only if not yet merged)
4. Release Please will create a new Release PR

### Need to Skip a Release

**Scenario**: You want to merge a PR but don't want to trigger a release yet.

**Solution**: Use `chore` or `docs` type in the commit message:
```
chore: update dependencies
docs: improve README
```

These types don't trigger version bumps.

### Need to Force a Release

**Scenario**: You want to release even though no conventional commits were detected.

**Solution**: Create a PR with a `feat` or `fix` commit, or manually edit the Release PR version numbers.

## FAQ

**Q: Can I manually edit the Release PR?**
A: Yes. You can edit the version numbers or changelog entries in the Release PR before merging.

**Q: What if I need to release multiple packages at different versions?**
A: The hybrid versioning strategy handles this. Platform packages (backend, dashboard, api-contract) share a version, while SDK is independent.

**Q: Can I release just the SDK without the platform?**
A: Yes. If only SDK changes are detected, only the SDK version will be bumped and released.

**Q: How do I know what version to expect?**
A: Release Please calculates the version based on conventional commits since the last release. Check the Release PR to see the proposed version.

**Q: What if a commit message is wrong?**
A: If the Release PR is already created, you can edit it. If not yet created, fix the commit message and Release Please will detect the change on the next run.

**Q: How often does Release Please run?**
A: Release Please runs on every push to `main`. It creates a Release PR if conventional commits are detected since the last release.

## Implementation Details

### Files and Configuration

**Configuration Files**:
- `.release-please.json` - Release Please configuration with hybrid versioning
- `.release-please-manifest.json` - Auto-generated manifest tracking current versions

**Workflows**:
- `.github/workflows/release-please.yml` - Automated release workflow
- `.github/workflows/deploy-platform-production.yml` - Production deployment workflow (triggered by tags)

**Changelogs** (auto-generated):
- `apps/backend/CHANGELOG.md`
- `apps/dashboard/CHANGELOG.md`
- `packages/api-contract/CHANGELOG.md`
- `packages/assessment-sdk/CHANGELOG.md`

### Versioning Strategy (Hybrid)

| Package | Versioning | Current Version |
|---------|-----------|-----------------|
| backend | Shared (platform) | 3.26.0 |
| dashboard | Shared (platform) | 3.26.0 |
| api-contract | Shared (platform) | 3.26.0 |
| assessment-sdk | Independent | 0.1.0 |
| internal packages | Unversioned | N/A |

**Platform Release**: When backend, dashboard, or api-contract changes are released, they share a single version number.

**SDK Release**: Assessment SDK is versioned independently and can be released separately from the platform.

**Internal Packages**: Packages like `authz`, `database`, etc. are not versioned and not published.

### Why Release Please?

- ✅ Low friction: no per-PR files required
- ✅ Uses PR titles (conventional commits)
- ✅ Automatically generates release PRs, tags, and changelogs
- ✅ Supports monorepo with per-package versioning
- ✅ Integrates seamlessly with GitHub

### Tag Format

Tags are created automatically when Release PR is merged:
- `backend-v3.27.0` - Backend release
- `dashboard-v3.27.0` - Dashboard release
- `api-contract-v3.27.0` - API contract release
- `assessment-sdk-v0.2.0` - SDK release (independent version)

### Bootstrap Configuration

Release Please uses two bootstrap fields in `.release-please.json`:

**`bootstrap-sha`** (commit SHA):
- Tells Release Please where to start scanning for conventional commits on the first run
- Set to `"3a7a1a157"` (the commit before this release strategy was introduced)
- Prevents Release Please from scanning the entire repo history
- **Should be removed after the first release** — otherwise it will override Release Please's version calculations on every subsequent run
- Safe to keep during development/testing; remove it once you've completed your first real release

**`release-as`** (version numbers):
- Specifies the initial versions for each package
- Used only on the first run to bootstrap the `.release-please-manifest.json` file
- **Should be removed after the first release** — the manifest will track versions from that point forward

### Testing the Setup

1. **Create a test branch** with a conventional commit title
2. **Merge to main** using squash merge
3. **Verify Release PR** is created with updated versions and changelogs
4. **Review and merge Release PR**
5. **Verify tags** are created and GitHub Releases are published
6. **Verify production deployment** workflow is triggered
7. **After first release**: Remove both `bootstrap-sha` and `release-as` fields from `.release-please.json`

## Quick Reference Checklist

### Before Release
- [ ] Create PR with conventional commit title: `type(scope): description`
- [ ] All tests pass in CI
- [ ] Code review completed
- [ ] Use **squash merge** when merging to main

### Release PR Review (Gate 1)
- [ ] Changelog entries are accurate
- [ ] Version bumps are appropriate
- [ ] No unintended packages were bumped
- [ ] Breaking changes are documented
- [ ] QA Lead approves
- [ ] Tech Lead approves

### Production Deployment (Gate 2)
- [ ] All tests pass in CI
- [ ] Staging deployment successful
- [ ] No critical issues in staging
- [ ] Tech Lead approves
- [ ] Product Owner approves

## Related Documentation

- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format
- [Release Please](https://github.com/googleapis/release-please) - Automated versioning tool
- [CONTRIBUTING.md](./CONTRIBUTING.md) - General contribution guidelines
