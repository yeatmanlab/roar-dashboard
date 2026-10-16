---
title: PR Creation
description: Branch naming, commit messages, PR description format, draft mode, and pre-push verification.
impact: MEDIUM
scope: all
tags: pull-requests, git, workflow, quality
---

## PR creation

Conventions for creating pull requests in this repository.

### Branch naming

Use a prefix that matches the type of change, followed by the ticket number and a short description:

```
<prefix>/<ticket-number>/<short-description>
```

| Prefix | Use for | Example |
|--------|---------|---------|
| `enh/` | New features and enhancements | `enh/1649/backend-testing-infra` |
| `fix/` | Bug fixes | `fix/1580/consent-modal` |
| `refactor/` | Refactoring | `refactor/1602/compute-task-data` |
| `maint/` | Maintenance and housekeeping | `maint/1700/agent-rules` |
| `dep/` | Dependency updates | `dep/bump-phoneme-4-0-0` |
| `infra/` | Infrastructure changes | `infra/1685/cloud-run-deployment` |

Always include the ticket number. Every meaningful change should have a corresponding issue in the [yeatmanlab/roar-project-management](https://github.com/yeatmanlab/roar-project-management) repository for traceability. The rare exception is mechanical work like dependency bumps (`dep/`) where a ticket adds no value — but if there's no ticket, ask yourself whether there should be.

### Commit messages

Conventional commit format — `type(scope): description`, imperative, lowercase, no trailing period:

```
fix(dashboard): reject an API base URL that is not a bare origin
refactor(dashboard): replace the sign-in redirect store subscription with a once-firing watch
enh(backend): add DELETE /v1/administrations/:id endpoint
```

### Draft mode

Create pull requests in draft mode by default so a human reviewer can mark them ready for review.

### PR description

The PR template (`.github/PULL_REQUEST_TEMPLATE.md`) defines the structure. Fill it in rather than replacing it:

- **`## Summary`** — the first sentence begins with "This PR …" and gives a clear, concise explanation of the changes. Add further `##` headings below if more detail is needed. For architectural or flow changes, include Mermaid diagrams where they add clarity.
- **`## How to Test`** — numbered steps a reviewer can follow to validate the change. Delete the section when it doesn't apply.
- **`## Checklist`** — keep it and tick what's done. The items are deliberately only things CI can't verify (self-review, tests, docs, `/review-pr`). If docs were updated, link the roar-docs PR on that line.
- **`## Screenshots`** — screenshots or recordings for UI changes. Delete the section when it doesn't apply.

Issues live in the `yeatmanlab/roar-project-management` repository, so always end the description with the cross-repo form:

```
Resolves yeatmanlab/roar-project-management#NNNN
```

A bare `Resolves #NNNN` points at a roar-dashboard issue number and won't close the ticket.

```markdown
## Summary

This PR adds a DELETE /v1/administrations/:id endpoint that soft-deletes
an administration and cascades to junction tables.

## How to Test

1. Sign in as a district admin.
2. Delete an administration from the administrations list.
3. Confirm it disappears from the list and its assignments are gone.

## Checklist

- [x] Self-reviewed the full diff
- [x] Added or updated tests where applicable
- [ ] Updated documentation if needed (link the roar-docs PR here)
- [x] Ran the Claude `/review-pr` command before requesting human review

Resolves yeatmanlab/roar-project-management#1649
```

### Bug-fix PRs

PRs on a `fix/` branch replace the default template body with the bug shape. Same top heading, same checklist tail, but the Summary breaks out root cause and fix, and testing splits into reproduce/verify:

```markdown
## Summary

<!-- What was the bug, in one or two sentences. Include impact: since when,
     who was affected, how severe. -->

### Root Cause

<!-- What caused this bug? Be specific. -->

### Fix

<!-- What does this PR change to fix the bug? -->

## How to Reproduce

1.

## How to Verify

1.

## Regression Risk

<!-- Could this fix break anything else? Delete if genuinely isolated. -->

## Checklist

- [ ] Fix addresses the root cause, not just symptoms
- [ ] Self-reviewed the full diff
- [ ] Added or updated tests to prevent regression
- [ ] Updated documentation if needed (link the roar-docs PR here)
- [ ] Ran the Claude `/review-pr` command before requesting human review

Resolves yeatmanlab/roar-project-management#XXXX
```

"How to Verify" is the bug-shape name for the default template's "How to Test" — reviewer validation steps either way. Severity, affected users, and duration are triage facts that belong on the roar-project-management issue; in the PR they are one sentence in the Summary, not a section.

### PR title

PRs are squash-merged to `main`, so the PR title becomes the commit message in the main branch history. Write it as a conventional commit, with the same care as any commit message — specific enough to be meaningful in `git log`:

```
enh(backend): add DELETE /v1/administrations/:id endpoint
fix(dashboard): fix timezone handling in score report exports
refactor(backend): use ltree subqueries in access controls
```

A vague title like `fix: update backend` pollutes the main branch history permanently.

### Size limits

Keep PRs small and focused — one concern per PR. If a change spans multiple layers (contract, repository, service, controller, route), that's fine as long as it's a single feature or fix. Split unrelated changes into separate PRs.

### Chaining PRs

When building out a larger feature, chain PRs by branching each one off the previous:

```
main → enh/1649/admin-repository → enh/1649/admin-service → enh/1649/admin-controller
```

Each PR targets the previous branch, keeping diffs small and reviewable. Merge them bottom-up once approved.

### Before pushing

Run these from the repo root to catch issues before CI does:

```bash
npm run lint          # ESLint
npm run format:check  # Prettier
npm run check-types   # TypeScript
npm run test          # Unit + integration tests
```

### The principle

Small, well-described PRs get reviewed faster and are easier to revert. Draft mode prevents premature reviews. Running checks locally before pushing avoids wasted CI cycles and noisy PR timelines.
