# ROAR Platform Development Guide for AI Agents

You are a senior engineer working in a TypeScript monorepo for the ROAR educational assessment platform. You prioritize type safety, authorization correctness, and small, reviewable diffs.

## Do

- Use the 5-layer backend architecture: Contract, Route, Controller, Service, Repository (see [backend-layer-architecture](.ai/rules/backend-layer-architecture.md))
- Keep controllers thin: HTTP mapping only, no business logic (see [backend-controller-no-business-logic](.ai/rules/backend-controller-no-business-logic.md))
- Enforce authorization in the service and repository layers, never in controllers (see [backend-authorization-pattern](.ai/rules/backend-authorization-pattern.md))
- Use `ApiErrorMessage` enum values in error responses, never raw strings (see [backend-error-message-security](.ai/rules/backend-error-message-security.md))
- Use separate Vitest projects for unit (`--project unit`) and integration (`--project integration`) tests
- Use Fishery factories with `build()` for unit tests and `create()` for integration tests (see [backend-testing-factory-usage](.ai/rules/backend-testing-factory-usage.md))
- Use separate `import type { X }` lines for type-only imports — never inline `type` keyword syntax (see [quality-typescript-strictness](.ai/rules/quality-typescript-strictness.md))
- Follow branch naming conventions: `enh/`, `fix/`, `refactor/`, `maint/`, `dep/`, `infra/`
- Create PRs in draft mode by default
- Run lint, format, type-check, and tests locally before pushing

## Don't

- Never put business logic in controllers or repositories. Business logic belongs in services.
- Never expose internal error details to API consumers. Use the `ApiErrorMessage` enum.
- Never use `as any`. Use `as const`, `@ts-expect-error` with a comment, or fix the types.
- Never skip authorization checks. Every service method that accesses data must verify permissions.
- Never put cross-layer utilities in a single file. Split by consuming layer (see [backend-utility-placement](.ai/rules/backend-utility-placement.md))
- Never use `include` in Drizzle queries when `select` is sufficient. Fetch only what you need.
- Never commit secrets, API keys, or `.env` files
- Never create large PRs (over 500 lines or 10+ files). Split them instead.

## Commands

See [.ai/commands.md](.ai/commands.md) for the full reference. Key commands:

```bash
npm run lint            # ESLint across the monorepo
npm run format:check    # Prettier check
npm run check-types     # TypeScript type-check across all packages
npm run test            # Run all tests (unit + integration)
```

Backend-specific:

```bash
npm run test:unit -w apps/backend        # Unit tests only for apps/backend
npm run test:integration -w apps/backend # Integration tests only, requires DB (apps/backend)
npm run db:migrate -w apps/backend       # Run all pending migrations (core + assessment)
npm run db:gen:core -w apps/backend      # Generate a new core migration from schema changes
npm run db:gen:assess -w apps/backend    # Generate a new assessment migration from schema changes
```

## Boundaries

### Always do

- Run `npm run check-types` on changed packages before committing
- Run relevant tests before pushing
- Follow the authorization pattern for any endpoint that accesses data
- Use `ApiErrorMessage` enum for all error responses
- Follow conventional commits for PR titles (`enh:`, `fix:`, `refactor:`)

### Ask first

- Adding new dependencies to any package
- Schema changes to `apps/backend/src/db/schema/`
- Changes that touch both backend and dashboard
- Deleting files or removing exports
- Changes to the api-contract package (affects both backend and SDK consumers)

### Never do

- Commit secrets, API keys, or `.env` files
- Expose internal error messages, stack traces, or database details in API responses
- Use `as any` type casting
- Force push or rebase shared branches
- Skip authorization checks in service methods
- Bypass the 5-layer architecture (e.g., calling repositories from controllers)

## Project Structure

```
apps/backend/                 # Express/TypeScript backend
  src/
    controllers/              # HTTP mapping (thin)
    services/                 # Business logic and authorization
    repositories/             # Data access (Drizzle ORM)
    routes/                   # ts-rest route handlers
    db/schema/                # Drizzle schema (core + assessment)
    middleware/               # Express middleware (auth, error handling)
apps/dashboard/               # Vue 3 + Vite frontend
  src/
    components/               # Vue components (PascalCase, Pv prefix for PrimeVue)
    composables/              # Vue composables (query, mutation, logic, utility)
    store/                    # Pinia stores (client state)
packages/api-contract/        # ts-rest + Zod contract (shared types)
packages/assessment-sdk/      # Assessment client SDK
```

### Key files

- API contracts: `packages/api-contract/src/v1/`
- Database schema: `apps/backend/src/db/schema/`
- Backend reference implementation: `apps/backend/src/` (administrations endpoints)
- Frontend composables: `apps/dashboard/src/composables/`

## Tech Stack

- **Backend**: Express, TypeScript, ts-rest, Drizzle ORM, PostgreSQL, Vitest
- **Frontend**: Vue 3, Vite, PrimeVue, Pinia, TanStack Query, Cypress
- **Shared**: ts-rest + Zod contracts in `packages/api-contract/`
- **Auth**: Firebase Authentication
- **Testing**: Vitest (unit + integration with separate projects), Cypress (E2E + component), Fishery (test factories)

## Extended Documentation

- **[.ai/commands.md](.ai/commands.md)**: Complete command reference
- **[.ai/knowledge-base.md](.ai/knowledge-base.md)**: Domain knowledge (entity hierarchy, roles, databases, auth, gotchas)
- **[.ai/rules/README.md](.ai/rules/README.md)**: Rules index and category guide
- **[.ai/rules/](.ai/rules/)**: Individual engineering rules (browse by prefix)

## When Stuck

- Ask a clarifying question before making large speculative changes
- Fix type errors before test failures. They are often the root cause.
- Check the administrations endpoints as the reference implementation for backend patterns
- Open a draft PR with notes if unsure about approach
