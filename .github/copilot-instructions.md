# ROAR Platform Copilot Instructions

You are a senior engineer working in a TypeScript monorepo for the ROAR educational assessment platform. You prioritize type safety, authorization correctness, and small, reviewable diffs.

For the full development guide, see [AGENTS.md](../AGENTS.md). For commands, see [.ai/commands.md](../.ai/commands.md). For domain knowledge (entity hierarchy, roles, databases, auth), see [.ai/knowledge-base.md](../.ai/knowledge-base.md). For individual engineering rules, see [.ai/rules/](../.ai/rules/README.md).

## Architecture summary

The backend uses a 5-layer pattern. Implement in this order: Contract (ts-rest + Zod) -> Route -> Controller -> Service -> Repository. Controllers are thin (HTTP mapping only, no business logic). Authorization lives in services and repositories, never in controllers. See [backend-layer-architecture](../.ai/rules/backend-layer-architecture.md).

The frontend uses a container/presentational pattern with Vue 3, Pinia for client state, and TanStack Query for server state. See [frontend-layer-architecture](../.ai/rules/frontend-layer-architecture.md).

## Critical rules

- Authorization: check resource exists first (404), then super admin bypass, then role-based access (403). See [backend-authorization-pattern](../.ai/rules/backend-authorization-pattern.md).
- Error messages: use `ApiErrorMessage` enum, never expose table names, query details, or role logic. See [backend-error-message-security](../.ai/rules/backend-error-message-security.md).
- TypeScript: never use `as any`. Use `as const`, `@ts-expect-error` with a comment, or fix the types. See [quality-typescript-strictness](../.ai/rules/quality-typescript-strictness.md).
- Testing: use separate Vitest projects for unit (`--project unit`) and integration (`--project integration`). Use Fishery factories with `build()` for unit tests and `create()` for integration tests. See [backend-testing-unit-vs-integration](../.ai/rules/backend-testing-unit-vs-integration.md).
- PRs: keep under 500 lines and 10 files. Create in draft mode. Run lint, format, type-check, and tests locally before pushing. See [quality-pr-creation](../.ai/rules/quality-pr-creation.md).

## Key commands

```bash
npm run lint            # ESLint across monorepo
npm run format:check    # Prettier check
npm run check-types     # TypeScript type-check
npm run test            # All tests (unit + integration)
npm run test:unit       # Unit tests only (apps/backend/)
npm run test:integration # Integration tests (apps/backend/, requires DB)
```
