# Assessment SDK Publishing Workflow

This directory contains an automated CI/CD workflow for publishing the Assessment SDK to GitHub Package Registry. The workflow handles both `next` pre-release and `stable` release publishing based on the trigger type.

## Workflow: `publish-assessment-sdk.yml`

Publishes Assessment SDK versions to GitHub Package Registry based on the trigger:
- **Next releases**: Triggered on push to `main` with changes to `packages/assessment-sdk/**`
- **Stable releases**: Triggered on git tag push matching `assessment-sdk-v*`

### Next Release (on main push)

**Trigger**: Push to `main` branch with changes to `packages/assessment-sdk/**`

**Process**:
1. Builds API Contract
2. Builds the SDK
3. Computes next prerelease version using the GitHub Actions run number (e.g., `0.0.1-next.42`, `0.0.1-next.43`, etc.)
4. Temporarily updates package.json for publishing only
5. Publishes to GitHub Package Registry with `next` dist-tag
6. Restores original package.json (no commit to main)

**Important**: This workflow does NOT commit version changes back to main. The prerelease version is computed using `github.run_number` to ensure every workflow run produces a unique, always-incrementing version. This keeps the main branch clean, prevents self-triggered reruns, and ensures no republish conflicts.

### Stable Release (on tag push)

**Trigger**: Git tag push matching `assessment-sdk-v*` (e.g., `assessment-sdk-v1.2.3`)

**Tag Format**: `assessment-sdk-v<MAJOR>.<MINOR>.<PATCH>` (e.g., `assessment-sdk-v1.2.3`)

**Process**:
1. Validates that the tag version matches `package.json` version
2. Builds API Contract
3. Builds the SDK
4. Publishes to GitHub Package Registry with `latest` dist-tag

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

**Important**: The tag version MUST match the version in `packages/assessment-sdk/package.json` exactly. The workflow validates this before publishing.

### Concurrency

Both next and stable releases use the same concurrency group (`publish-assessment-sdk`) with `cancel-in-progress: false` to prevent simultaneous publishes.

## Required Secrets

Both workflows use the default `GITHUB_TOKEN` provided by GitHub Actions for publishing to GitHub Package Registry. No additional secrets need to be configured.

## Registry Configuration

Both workflows publish to GitHub Package Registry (`https://npm.pkg.github.com`) using the `@roar-platform` scope.

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
npm install @roar-platform/assessment-sdk@latest
```

### Next Pre-release
```bash
npm install @roar-platform/assessment-sdk@next
```

## Troubleshooting

### Workflow fails with "Unable to resolve action"

These are IDE linter warnings for external GitHub Actions. They don't affect workflow execution at runtime.

### Publish step fails with authentication error

Ensure the `setup-node` step includes `registry-url: 'https://npm.pkg.github.com'`. The workflows use the default `GITHUB_TOKEN` which is automatically available in GitHub Actions.

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

The unified workflow uses minimal required permissions:
- `contents: read` - For reading repository contents (checkout, validate versions)
- `packages: write` - For publishing to GitHub Package Registry

These are configured in the workflow YAML file.
