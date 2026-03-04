# ROAR Engineering Rules

This directory contains modular, enforceable engineering rules for the ROAR Platform. Rules are both human-readable (for engineers to browse and learn from) and machine-readable (for AI coding tools to consume automatically).

## Rules Index

### Architecture

| Rule | Impact | Description |
|------|--------|-------------|
| [architecture-authorization-model](architecture-authorization-model.md) | CRITICAL | ltree hierarchy, per-entity roles, supervisory/supervised distinction, two-layer authorization |

### Backend

| Rule | Impact | Description |
|------|--------|-------------|
| [backend-layer-architecture](backend-layer-architecture.md) | CRITICAL | 5-layer pattern: Contract, Route, Controller, Service, Repository |
| [backend-authorization-pattern](backend-authorization-pattern.md) | CRITICAL | Authorization in service/repository layers, verifyResourceAccess, 404-before-403 |
| [backend-error-message-security](backend-error-message-security.md) | CRITICAL | ApiErrorMessage enum, no internal details in responses |
| [backend-api-contract-conventions](backend-api-contract-conventions.md) | HIGH | ts-rest + Zod contracts, shared schemas, response envelopes, embed pattern |
| [backend-controller-no-business-logic](backend-controller-no-business-logic.md) | HIGH | Controllers handle HTTP mapping only, no business logic |
| [backend-error-handling](backend-error-handling.md) | HIGH | Service try/catch, controller error mapping, global handler |
| [backend-repository-pattern](backend-repository-pattern.md) | HIGH | BaseRepository extension, listAll/listAuthorized, access control joins |
| [backend-service-pattern](backend-service-pattern.md) | HIGH | Closure-based DI, default parameter injection |
| [backend-testing-unit-vs-integration](backend-testing-unit-vs-integration.md) | MEDIUM | Separate Vitest projects, vi.mock for controllers, DI for services |
| [backend-testing-factory-usage](backend-testing-factory-usage.md) | MEDIUM | build() vs create(), baseFixture, Fishery factories |

### Frontend

| Rule | Impact | Description |
|------|--------|-------------|
| [frontend-layer-architecture](frontend-layer-architecture.md) | HIGH | Container/presentational pattern, directory structure, PrimeVue Pv prefix |
| [frontend-state-management](frontend-state-management.md) | HIGH | Pinia for client state, TanStack Query for server state |
| [frontend-composable-patterns](frontend-composable-patterns.md) | MEDIUM | Query, mutation, logic, and utility composables |

### Quality

| Rule | Impact | Description |
|------|--------|-------------|
| [quality-code-review](quality-code-review.md) | HIGH | Review standards for human and AI-generated code |
| [quality-no-followup-prs](quality-no-followup-prs.md) | MEDIUM | Complete small refactors in the current PR |
| [quality-code-style](quality-code-style.md) | MEDIUM | Constants, naming conventions, structured logging, JSDoc |
| [quality-pr-creation](quality-pr-creation.md) | MEDIUM | Branch naming, commit messages, draft mode, PR description |
| [quality-typescript-strictness](quality-typescript-strictness.md) | MEDIUM | as const, @ts-expect-error, avoid as any |

### Testing

| Rule | Impact | Description |
|------|--------|-------------|
| [testing-coverage-expectations](testing-coverage-expectations.md) | HIGH | Risk-tiered coverage targets, behavior-focused testing |

### Performance

| Rule | Impact | Description |
|------|--------|-------------|
| [performance-avoid-quadratic](performance-avoid-quadratic.md) | HIGH | Avoid O(n^2) in access control, embed resolution, and pagination |

### CI/CD

| Rule | Impact | Description |
|------|--------|-------------|
| [ci-check-failures](ci-check-failures.md) | HIGH | Focus on failures related to your changes, run checks locally first |

### Culture

| Rule | Impact | Description |
|------|--------|-------------|
| [culture-leverage-ai](culture-leverage-ai.md) | HIGH | AI agents accelerate boilerplate but require human review for auth and scoring logic |

## Structure

Rules use a flat structure with prefix-based categories:

| Prefix | Scope |
|--------|-------|
| `architecture-` | System design and structural decisions |
| `backend-` | Express/TypeScript backend (`apps/backend/`) |
| `frontend-` | Vue 3 dashboard (`apps/dashboard/`) |
| `quality-` | TypeScript strictness and code quality |
| `testing-` | Test conventions (unit and integration) |
| `performance-` | Optimization and efficiency |
| `ci-` | Continuous integration and deployment |
| `culture-` | Team process and collaboration |

Each rule file follows the naming convention `{prefix}{rule-name}.md` (e.g., `backend-error-handling.md`).

## Impact Levels

- **CRITICAL**: Violations cause security issues, broken authorization, or data leaks. Must always be followed.
- **HIGH**: Violations cause architectural inconsistency or maintenance burden. Follow unless there is a documented reason not to.
- **MEDIUM**: Best practices that improve consistency. Follow for new code; existing code is grandfathered.

## How to Use

Rules are designed to work with any AI coding tool and for direct human reference.

**AI tools:** Each tool discovers rules through its own convention. No manual configuration is needed.

- **Claude Code**: `CLAUDE.md` at the repo root (symlink to `AGENTS.md`) plus `.claude/rules/` (symlink to `.ai/rules/`).
- **Cursor**: `.cursor/rules/` (symlink to `.ai/rules/`).
- **GitHub Copilot**: The Copilot coding agent reads `AGENTS.md` directly.

**Engineers:** Browse rules by prefix to find conventions for the area you are working in. Each rule is self-contained with incorrect/correct examples and references to canonical implementations.

## Contributing

1. Use the template below to create a new rule file
2. Use the appropriate prefix for your rule's scope
3. Write a clear `description` in frontmatter. It is the first thing humans and AI tools see.
4. Include concrete incorrect/correct examples from this codebase
5. Add the rule in the same PR that introduces or changes the pattern

## Rule Template

```markdown
---
title: Rule Title
description: A brief, natural-language summary of what this rule is about.
impact: CRITICAL | HIGH | MEDIUM
scope: backend | frontend | shared | all
tags: tag1, tag2
---

## Rule title

Brief explanation (2-3 sentences) of what this enforces and why.

### Incorrect

\```typescript
// Anti-pattern with explanation
\```

### Correct

\```typescript
// Correct approach with explanation
\```

### The principle

One paragraph on the underlying rationale and what goes wrong when this rule is violated.
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
