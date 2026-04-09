# Assessment SDK Publishing Workflows

This directory contains automated CI/CD workflows for publishing the Assessment SDK to GitHub Package Registry.

## Workflows

### `publish-assessment-sdk-stable.yml`

Publishes stable releases of the Assessment SDK when a git tag matching `assessment-sdk-v*` is pushed.

**Trigger**: Git tag push (e.g., `assessment-sdk-v1.2.3`)

**Tag Format**: `assessment-sdk-v<MAJOR>.<MINOR>.<PATCH>` (e.g., `assessment-sdk-v1.2.3`)

**Process**:
1. Validates that the tag version matches `package.json` version
2. Builds the SDK
3. Runs tests
4. Publishes to GitHub Package Registry with `latest` dist-tag
5. Creates a GitHub Release

**Release Process**:
```bash
# 1. Update version in package.json
cd packages/assessment-sdk
npm version patch  # or minor/major

# 2. Commit and push to main
git add package.json
git commit -m "chore: bump assessment-sdk to X.Y.Z"
git push origin main

# 3. Create and push the tag (this triggers the stable workflow)
git tag assessment-sdk-v$(node -p "require('./package.json').version")
git push origin assessment-sdk-v$(node -p "require('./package.json').version")
```

**Important**: The tag version MUST match the version in `packages/assessment-sdk/package.json` exactly. The stable workflow validates this before publishing.

### `publish-assessment-sdk-next.yml`

Publishes pre-release versions of the Assessment SDK when changes are merged to `main`.

**Trigger**: Push to `main` branch with changes to `packages/assessment-sdk/**`

**Process**:
1. Builds the SDK
2. Runs tests
3. Computes next prerelease version using the GitHub Actions run number (e.g., `0.0.1-next.42`, `0.0.1-next.43`, etc.)
4. Temporarily updates package.json for publishing only
5. Publishes to GitHub Package Registry with `next` dist-tag
6. Restores original package.json (no commit to main)

**Important**: This workflow does NOT commit version changes back to main. The prerelease version is computed using `github.run_number` to ensure every workflow run produces a unique, always-incrementing version. This keeps the main branch clean, prevents self-triggered reruns, and ensures no republish conflicts.

**Concurrency**: Only one next release can run at a time to prevent version conflicts.

## Required Secrets

Both workflows require the `CI_GITHUB_PAT` secret to be configured in repository settings. This token is used for:
- Repository checkout with submodules (required to access the private env-configs submodule)
- Publishing to GitHub Package Registry
- Creating GitHub Releases

The `CI_GITHUB_PAT` token must have the following scopes:
- `repo` (full control of private repositories)
- `write:packages` (publish packages to GitHub Package Registry)

## Registry Configuration

Both workflows publish to GitHub Package Registry (`https://npm.pkg.github.com`) using the `@roar-dashboard` scope.

The Assessment SDK's `package.json` includes:
```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

This ensures `npm publish` automatically targets the correct registry.

## Installation

### Stable Release
```bash
npm install @roar-dashboard/assessment-sdk@latest
```

### Next Pre-release
```bash
npm install @roar-dashboard/assessment-sdk@next
```

## Troubleshooting

### Workflow fails with "Unable to resolve action"

These are IDE linter warnings for external GitHub Actions. They don't affect workflow execution at runtime.

### Publish step fails with authentication error

Ensure:
1. `CI_GITHUB_PAT` secret is configured in repository settings
2. The token has `write:packages` scope
3. The `setup-node` step includes `registry-url: 'https://npm.pkg.github.com'`

### Version mismatch error (stable workflow only)

The tag version must match the version in `packages/assessment-sdk/package.json`. Example:
- Tag: `assessment-sdk-v1.2.3`
- package.json: `"version": "1.2.3"`

### Next workflow doesn't commit version changes

By design, the next workflow does NOT commit version changes back to main. This prevents:
- Self-triggered workflow reruns (the workflow would retrigger itself)
- Version history pollution on main (e.g., `2.2.0-next.3` versions persisting)
- Conflicts with stable release workflows

The prerelease version is computed and used only for publishing. The main branch always reflects the intended stable version.

## Permissions

### Stable Workflow
- `contents: write` - For creating GitHub Releases
- `packages: write` - For publishing to GitHub Package Registry

### Next Workflow
- `packages: write` - For publishing to GitHub Package Registry (no `contents: write` needed since it doesn't create commits or releases)

These are configured in the workflow YAML files.
