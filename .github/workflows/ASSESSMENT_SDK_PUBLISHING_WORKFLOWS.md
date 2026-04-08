# Assessment SDK Publishing Workflows

This directory contains automated CI/CD workflows for publishing the Assessment SDK to GitHub Package Registry.

## Workflows

### `publish-assessment-sdk-stable.yml`

Publishes stable releases of the Assessment SDK when a git tag matching `assessment-sdk-v*` is pushed.

**Trigger**: Git tag push (e.g., `assessment-sdk-v1.2.3`)

**Process**:
1. Validates that the tag version matches `package.json` version
2. Builds the SDK
3. Runs tests
4. Publishes to GitHub Package Registry with `latest` dist-tag
5. Creates a GitHub Release

**Usage**:
```bash
cd packages/assessment-sdk
npm version patch  # or minor/major
git push origin main
git tag assessment-sdk-v$(node -p "require('./package.json').version")
git push origin assessment-sdk-v$(node -p "require('./package.json').version")
```

### `publish-assessment-sdk-next.yml`

Publishes pre-release versions of the Assessment SDK when changes are merged to `main`.

**Trigger**: Push to `main` branch with changes to `packages/assessment-sdk/**`

**Process**:
1. Builds the SDK
2. Runs tests
3. Auto-increments prerelease version (e.g., `0.0.1-next.1`)
4. Commits version update back to main
5. Publishes to GitHub Package Registry with `next` dist-tag

**Concurrency**: Only one next release can run at a time to prevent version conflicts.

## Required Secrets

Both workflows use the automatically-provided `GITHUB_TOKEN` for checking out the repository with submodules. No additional secrets need to be configured.

The `GITHUB_TOKEN` is automatically available in GitHub Actions and has sufficient permissions for:
- Repository checkout with submodules
- Publishing to GitHub Package Registry
- Creating GitHub Releases

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

### Git push fails in next workflow

If the commit push fails (e.g., due to branch protection), the package may already be published. The workflow includes `git pull --rebase` to handle concurrent merges.

## Permissions

Both workflows require the following GitHub Actions permissions:

- `contents: write` - For creating commits and GitHub Releases
- `packages: write` - For publishing to GitHub Package Registry

These are configured in the workflow YAML files.
