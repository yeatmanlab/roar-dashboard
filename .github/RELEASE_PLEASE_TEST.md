# Release Please Testing Guide

This document outlines the step-by-step process to test the Release Please configuration, including hybrid versioning, grouped releases, and deployment triggers.

## Test Setup

### Step 1: Create Test Branch

```bash
# Create a throwaway test branch off the current branch
git checkout -b test/release-please-validation

# Push to remote
git push -u origin test/release-please-validation
```

### Step 2: Update Release Workflow for Testing

Edit `.github/workflows/release.yml` to target the test branch instead of main:

**Change the trigger condition:**

```yaml
# Line ~18 (in the release-please job)
on:
  push:
    branches:
      - test/release-please-validation  # Changed from 'main'
```

**Add gate to deployment trigger:**

```yaml
# Line ~46 (in the trigger-platform-deployment job)
if: |
  github.ref == 'refs/heads/main' &&
  needs.release-please.outputs.releases_created == 'true' &&
  needs.release-please.outputs.backend_release_created == 'true' &&
  needs.release-please.outputs.dashboard_release_created == 'true'
```

This ensures the deployment job is skipped during testing (since we're on `test/release-please-validation`, not `main`).

**Commit and push:**

```bash
git add .github/workflows/release.yml
git commit -m "test: update release workflow to target test branch"
git push
```

## Test Execution

### Phase 1: Release PR Creation

#### Test 1.1: Backend Feature

```bash
# Create empty commit with conventional title
git commit --allow-empty -m "feat(backend): add new user endpoint"
git push
```

**Wait for Release Please to run** (check GitHub Actions tab)

**Expected result:**
- Release Please job completes successfully
- Release PR is created against `test/release-please-validation`
- Release PR title: `chore: release 3.27.0` (grouped title)
- Backend version bumps to `3.27.0`
- Dashboard version bumps to `3.27.0` (linked-versions)
- API contract version unchanged
- SDK version unchanged

#### Test 1.2: Dashboard Bug Fix

```bash
# Create empty commit with conventional title
git commit --allow-empty -m "fix(dashboard): resolve navigation bug"
git push
```

**Expected result:**
- Release Please updates the existing Release PR (or creates new one if already merged)
- Both backend and dashboard bump to `3.27.1` (linked-versions)
- API contract and SDK unchanged

#### Test 1.3: API Contract Release

```bash
# Create empty commit with conventional title
git commit --allow-empty -m "feat(api-contract): add new endpoint types"
git push
```

**Expected result:**
- Release Please creates a SEPARATE Release PR for api-contract
- API contract version bumps independently (e.g., `3.27.0` → `3.27.1`)
- Backend and dashboard remain at `3.27.1`
- Confirms hybrid versioning works

#### Test 1.4: SDK Release

```bash
# Create empty commit with conventional title
git commit --allow-empty -m "feat(sdk): add new data export method"
git push
```

**Expected result:**
- Release Please creates a SEPARATE Release PR for SDK
- SDK version bumps independently (e.g., `0.1.0` → `0.2.0`)
- Platform packages unchanged
- Confirms SDK independence

### Phase 1 Verification Checklist

- [ ] Release Please job runs on each push
- [ ] Grouped Release PR created for backend + dashboard
- [ ] Release PR title is `chore: release 3.27.0` (grouped)
- [ ] Backend and dashboard versions are identical (linked-versions)
- [ ] Per-package changelogs updated correctly:
  - [ ] `apps/backend/CHANGELOG.md` has new entries
  - [ ] `apps/dashboard/CHANGELOG.md` has new entries
  - [ ] `packages/api-contract/CHANGELOG.md` has separate entry
  - [ ] `packages/assessment-sdk/CHANGELOG.md` has separate entry
- [ ] API contract Release PR is separate from platform Release PR
- [ ] SDK Release PR is separate from platform Release PR
- [ ] `trigger-platform-deployment` job is **skipped** (not failed) due to `github.ref` gate

### Phase 2: Tag Creation and Deployment

#### Step 2.1: Merge Platform Release PR

```bash
# Go to GitHub and merge the platform Release PR (backend + dashboard)
# Use "Create a merge commit" to preserve the Release PR history
```

**Expected result:**
- Release Please automatically creates tags:
  - `backend-v3.27.0`
  - `dashboard-v3.27.0`
- GitHub Releases created for each tag
- `trigger-platform-deployment` job is **skipped** (due to `github.ref != 'refs/heads/main'`)

#### Step 2.2: Merge API Contract Release PR

```bash
# Go to GitHub and merge the API contract Release PR
```

**Expected result:**
- Release Please creates tag: `api-contract-v3.27.1`
- GitHub Release created

#### Step 2.3: Merge SDK Release PR

```bash
# Go to GitHub and merge the SDK Release PR
```

**Expected result:**
- Release Please creates tag: `assessment-sdk-v0.2.0`
- GitHub Release created

### Phase 2 Verification Checklist

- [ ] Tags created after merging Release PRs:
  - [ ] `backend-v3.27.0` exists
  - [ ] `dashboard-v3.27.0` exists
  - [ ] `api-contract-v3.27.1` exists
  - [ ] `assessment-sdk-v0.2.0` exists
- [ ] GitHub Releases created for each tag
- [ ] `trigger-platform-deployment` job is **skipped** on test branch (not triggered)
- [ ] No actual deployments occur (expected, since we're on test branch)

## Cleanup

### Step 3: Revert Workflow Changes

```bash
# Revert the workflow changes
git checkout main
git pull
git checkout test/release-please-validation
git revert <commit-hash-of-workflow-change>
git push
```

Or manually revert `.github/workflows/release.yml`:

```yaml
# Restore original trigger
on:
  push:
    branches:
      - main  # Back to main

# Restore original deployment gate
if: |
  needs.release-please.outputs.releases_created == 'true' &&
  needs.release-please.outputs.backend_release_created == 'true' &&
  needs.release-please.outputs.dashboard_release_created == 'true'
```

### Step 4: Delete Test Branch

```bash
# Delete local branch
git branch -d test/release-please-validation

# Delete remote branch
git push origin --delete test/release-please-validation
```

## Troubleshooting

### Release Please doesn't run

**Issue**: Push to test branch but Release Please job doesn't appear in Actions

**Solution**:
1. Check `.github/workflows/release.yml` is correctly configured to trigger on test branch
2. Verify the workflow file is on the test branch (not just main)
3. Check GitHub Actions settings — ensure workflows are enabled for the repo

### Release PR not created

**Issue**: Release Please runs but no Release PR is created

**Solution**:
1. Check Release Please logs in GitHub Actions
2. Verify `.release-please.json` is valid JSON
3. Verify conventional commit titles are correct (must be `feat`, `fix`, `refactor`, `perf`, etc.)
4. Check if Release PR already exists (Release Please won't create duplicates)

### Versions not bumping correctly

**Issue**: Backend and dashboard versions don't bump together

**Solution**:
1. Verify `linked-versions` plugin is configured in `.release-please.json`
2. Check that both `backend` and `dashboard` are in the `components` array
3. Verify the `groupName` is `platform`

### Deployment job not skipped

**Issue**: `trigger-platform-deployment` job runs even though we're on test branch

**Solution**:
1. Verify the `if:` condition includes `github.ref == 'refs/heads/main'`
2. Check that the condition is on the job, not just a step
3. Verify the branch name is exactly `refs/heads/main` (not `main` without `refs/heads/`)

## Expected Behavior Summary

| Scenario | Expected Result |
|----------|-----------------|
| Push `feat(backend):` | Platform Release PR created, backend + dashboard bump together |
| Push `fix(dashboard):` | Platform Release PR updated, backend + dashboard bump together |
| Push `feat(api-contract):` | Separate API contract Release PR created, independent version |
| Push `feat(sdk):` | Separate SDK Release PR created, independent version |
| Merge platform Release PR | Tags created: `backend-v*`, `dashboard-v*` |
| Merge API contract Release PR | Tag created: `api-contract-v*` |
| Merge SDK Release PR | Tag created: `assessment-sdk-v*` |
| Deployment trigger on test branch | **SKIPPED** (due to `github.ref` gate) |
| Deployment trigger on main branch | **TRIGGERED** (when platform Release PR merged) |

## Next Steps

After successful testing:

1. Revert workflow changes
2. Delete test branch
3. Create a real Release PR on main to verify end-to-end workflow
4. Document any findings or issues in the project wiki
5. Update team on Release Please process
