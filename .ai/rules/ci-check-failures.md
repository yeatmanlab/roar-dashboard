---
title: CI Check Failure Handling
description: Focus on CI failures related to your code changes. Run lint, format, type-check, and tests locally before pushing. Know which failures to investigate and which to ignore.
impact: HIGH
scope: all
tags: ci, github-actions, debugging, workflow
---

## CI check failure handling

The CI pipeline runs on every pull request via GitHub Actions. It includes four main jobs: Lint (lint + format + type-check), Tests (unit + integration with a real Postgres instance), Build, and Deploy (preview environment). E2E and component tests run separately via Cypress.

### Priority order for local checks

Run these locally before pushing. Fix them in this order, since earlier failures often cause later ones:

1. `npm run lint` (ESLint)
2. `npm run format:check` (Prettier)
3. `npm run check-types` (TypeScript)
4. `npm run test` (unit + integration tests)

Type errors are often the root cause of test failures. Fix types first.

### What to focus on

When CI fails on your PR:

1. **Focus only on failures related to your changes.** If the `lint` job fails on a file you didn't touch, check whether your changes introduced a transitive type error before dismissing it.
2. **E2E tests can be flaky.** Cypress tests run in parallel across Chrome and Edge. Intermittent failures in tests unrelated to your changes can usually be retried.
3. **Infrastructure failures** (like Docker image pulls or npm install timeouts) are not your problem. Retry the workflow.

### Before blaming CI

Always run `npm run check-types` locally before concluding that CI failures are unrelated to your changes. Even if errors appear in files you haven't directly modified, your changes might be causing type issues through dependencies or type inference.

### Incorrect

```
// CI fails on type-check
// Developer: "That file isn't mine, must be a CI issue"
// Developer pushes again without checking locally
// Same failure, wasted 20 minutes of CI time
```

### Correct

```
// CI fails on type-check
// Developer runs `npm run check-types` locally
// Discovers their new schema field causes a type error in a downstream service
// Fixes the type error, pushes once, CI passes
```

### The principle

CI exists to catch problems, not to be the first place you discover them. Running checks locally before pushing saves CI time, keeps the PR timeline clean, and avoids the "retry and hope" pattern that wastes everyone's time.
