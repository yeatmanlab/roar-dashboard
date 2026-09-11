---
title: Complete Small Refactors In-PR
description: If a small refactor can be done now, do it now. Follow-up PRs for minor improvements rarely materialize and accumulate as tech debt.
impact: MEDIUM
scope: all
tags: quality, pull-requests, refactoring, technical-debt
---

## Complete small refactors in-PR

If you notice a small improvement while working on a PR (a misleading variable name, a missing early return, an inline constant that should be extracted) fix it in the same PR. Don't leave a "TODO: clean up in follow-up" comment. Follow-up PRs for minor improvements rarely materialize, and each deferred fix becomes permanent tech debt.

### Incorrect

```typescript
// PR comment: "I'll rename this in a follow-up PR"
const d = await service.getById(authContext, id);
const r = transformItem(d);

// Six months later: the follow-up never happened, and now
// three other files reference `d` and `r` with no context
```

### Correct

```typescript
// Fix it in the same PR. Takes 30 seconds.
const resource = await service.getById(authContext, id);
const transformedResource = transformItem(resource);
```

### When follow-ups are acceptable

- **Substantial changes** that genuinely warrant a separate review, e.g., extracting a shared utility used across multiple services
- **Urgent fixes** where the current PR must ship immediately to unblock something
- **Cross-team changes** that require review from different stakeholders

If you're unsure whether something is "small enough" to include, it probably is. The bar for deferring should be high.

### The principle

The "slowness" of doing things right is an investment, not a cost. Every shortcut deferred to a follow-up PR becomes a permanent fixture of the codebase. Code that's clean from the start doesn't need cleanup sprints later.
