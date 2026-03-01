# ROAR Engineering Rules

This directory contains modular, enforceable engineering rules for the ROAR Platform. Rules are both human-readable (for engineers to browse and learn from) and machine-readable (for AI coding tools to consume automatically).

## Structure

Rules use a flat structure with prefix-based categories:

| Prefix | Scope |
|--------|-------|
| `architecture-` | System design and structural decisions |
| `api-` | API contract and response design |
| `backend-` | Express/TypeScript backend (`apps/backend/`) |
| `frontend-` | Vue 3 dashboard (`apps/dashboard/`) |
| `testing-` | Test conventions (unit and integration) |
| `quality-` | TypeScript strictness and code quality |
| `performance-` | Optimization and efficiency |
| `patterns-` | Reusable design patterns |
| `culture-` | Team process and collaboration |

Each rule file follows the naming convention `{prefix}{rule-name}.md` (e.g., `backend-error-handling.md`).

## Impact Levels

- **CRITICAL** — Violations cause security issues, broken authorization, or data leaks. Must always be followed.
- **HIGH** — Violations cause architectural inconsistency or maintenance burden. Follow unless there's a documented reason not to.
- **MEDIUM** — Best practices that improve consistency. Follow for new code; existing code is grandfathered.

## How to Use

Rules are designed to work with any AI coding tool and for direct human reference.

**AI tools:** A symlink at `.cursor/rules/` points to this directory so Cursor auto-discovers rules. Claude Code reads rules via `CLAUDE.md` references. GitHub Copilot picks up rules via `.github/copilot-instructions.md`. No manual configuration needed — just open the project and start working.

**Engineers:** Browse rules by prefix to find conventions for the area you're working in. Each rule is self-contained with incorrect/correct examples and references to canonical implementations.

## Contributing

1. Use the template below to create a new rule file
2. Use the appropriate prefix for your rule's scope
3. Include concrete incorrect/correct examples from this codebase
4. Set the `references` field to point to canonical implementations
5. Add the rule in the same PR that introduces or changes the pattern

## Rule Template

```markdown
---
title: Rule Title
impact: CRITICAL | HIGH | MEDIUM
scope: backend | frontend | shared | all
tags: tag1, tag2
references:
  - path/to/reference/implementation.ts
---

## Rule Title

**Impact:** CRITICAL | HIGH | MEDIUM

Brief explanation (2-3 sentences) of what this enforces and why.

### Incorrect

\```typescript
// Anti-pattern with explanation
\```

### Correct

\```typescript
// Correct approach with explanation
\```

### Why This Matters

One paragraph on consequences of violating this rule in the ROAR codebase.
```

## Reference Implementations

The administrations endpoints serve as the primary backend reference:
- Contract: `packages/api-contract/src/v1/administrations/`
- Repository: `apps/backend/src/repositories/administration.repository.ts`
- Service: `apps/backend/src/services/administration/administration.service.ts`
- Controller: `apps/backend/src/controllers/administrations.controller.ts`
- Routes: `apps/backend/src/routes/administrations.ts`

## Maintenance

- Target 20-25 rules max to avoid fatigue
- Update rules in the same PR that changes the pattern they describe
- Review quarterly: prune stale rules, add new ones for emerging patterns
