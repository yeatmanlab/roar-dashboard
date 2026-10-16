---
allowed-tools: Bash(npm run:*),Bash(git add:*),Bash(git commit:*),Bash(git push:*),Bash(git status:*),Bash(git diff:*),Bash(git log:*),Bash(gh pr create:*),Bash(gh api:*)
description: Run checks, commit, push, and create a draft pull request
---

Run the local checks from the repo root, in this order (earlier failures often cause later ones):

1. `npm run lint`
2. `npm run format:check`
3. `npm run check-types`
4. The tests relevant to the change (e.g., `npm run test:unit -w apps/backend`; integration tests if queries or DB behavior changed)

If they pass, commit the changes, push the branch, and create a pull request.

Staging discipline: stage explicit file paths only, built from the files actually edited. Never `git add -A`, `git add .`, or a directory sweep — untracked local files must not enter a commit.

Commit messages: conventional commit format `type(scope): description`, imperative, lowercase, no trailing period (see `.ai/rules/quality-pr-creation.md`).

PR body: fill in the repo template (`.github/PULL_REQUEST_TEMPLATE.md`) — Summary (first sentence "This PR …", complete sentences, no first person, no investigation narrative), How to Test, Checklist, Screenshots. Delete How to Test and Screenshots when they don't apply; tick only checklist items that actually happened. On a `fix/` branch, use the bug shape from `.ai/rules/quality-pr-creation.md` instead (Root Cause / Fix, How to Reproduce / How to Verify, Regression Risk, bug checklist).

Guidelines:

- PR title: conventional commit format `<type>(<scope>): <description>` — the type matches the branch prefix (`enh`, `fix`, `refactor`, `maint`, `dep`, `infra`), short, imperative, meaningful in `git log` (PRs are squash-merged, so the title becomes the main-branch commit message).
- Base branch: `project/backend-refactor` (the integration branch — `main` is legacy).
- Always include `Resolves` with the full ticket URL — extract the ticket number from the branch name (e.g., `fix/2204/...` → `2204`). Tickets live in `yeatmanlab/roar-project-management`, so the short `#NNNN` form does not auto-close them from this repo.
- Create PRs in draft mode by default.
- Mermaid diagrams are welcome for architectural or flow changes.
- `gh pr edit` is broken against this repo — update existing PRs via the REST API (`gh api -X PATCH repos/{owner}/{repo}/pulls/{number}`).
- Do not force push or amend unless explicitly asked.
