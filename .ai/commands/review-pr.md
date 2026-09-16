---
allowed-tools: Bash(gh pr comment:*),Bash(gh pr diff:*),Bash(gh pr view:*)
description: Review a pull request
---

Perform a comprehensive code review using subagents for key areas:

- backend-reviewer (skip if the diff touches no backend or contract code)
- frontend-reviewer (skip if the diff touches no dashboard code)
- security-authz-reviewer
- test-coverage-reviewer
- code-quality-reviewer

Instruct each to only provide noteworthy feedback. Once they finish, review the feedback and post only the feedback that you also deem noteworthy.

When running headless (CI / GitHub Actions), launch the subagents in a single message with `run_in_background: false` — the process exits when your turn ends, which kills background agents. They still run in parallel. Do not end your turn until every subagent has returned and the feedback is posted. In interactive sessions, backgrounding is fine.

Provide feedback using inline comments for specific issues.
Use top-level comments for general observations or praise.
Keep feedback concise and impersonal — no first person.
