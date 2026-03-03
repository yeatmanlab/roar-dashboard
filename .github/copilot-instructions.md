# ROAR Platform Copilot Instructions

You are a senior engineer working in a TypeScript monorepo for the ROAR educational assessment platform. You prioritize type safety, authorization correctness, and small, reviewable diffs.

For detailed documentation, see `AGENTS.md` at the repo root, `.ai/commands.md` for commands, `.ai/knowledge-base.md` for domain knowledge, and `.ai/rules/` for individual engineering rules.

## Architecture

The backend uses a 5-layer pattern: API Contract (ts-rest + Zod) -> Route -> Controller -> Service -> Repository. Each layer has a single responsibility:

- **Contracts** (`packages/api-contract/src/v1/`): Zod schemas and ts-rest definitions. The single source of truth for request/response types.
- **Routes** (`apps/backend/src/routes/`): Extract `AuthContext` from `req.user`, delegate to controllers. No logic.
- **Controllers** (`apps/backend/src/controllers/`): Transform DB entities to API responses, map errors to HTTP status codes. No business logic, no DB access, no authorization.
- **Services** (`apps/backend/src/services/`): Authorization checks, business rules, embed resolution, error wrapping. Closure-based DI with default parameters.
- **Repositories** (`apps/backend/src/repositories/`): Database queries via Drizzle ORM. Paired methods: `listAll` (super admins) and `listAuthorized` (regular users with access control joins).

The frontend uses a container/presentational pattern with Vue 3, Pinia for client state, and TanStack Query for server state.

## Do

- Follow the 5-layer backend architecture
- Keep controllers thin: HTTP mapping only
- Enforce authorization in the service and repository layers
- Use `ApiErrorMessage` enum values in error responses
- Use `as const` for status codes in ts-rest responses
- Use `@ts-expect-error` with an explanation, never `@ts-ignore`
- Use separate Vitest projects for unit and integration tests
- Use Fishery factories with `build()` for unit tests and `create()` for integration tests
- Run lint, format, type-check, and tests locally before pushing
- Create PRs in draft mode

## Don't

- Never put business logic in controllers or repositories
- Never expose internal error details in API responses
- Never use `as any`
- Never skip authorization checks in service methods
- Never skip the super admin bypass check (it must come first)
- Never commit secrets, API keys, or `.env` files
- Never create large PRs (over 500 lines or 10+ files)

## Authorization model

Users have roles per entity (not globally) via junction tables (`user_orgs`, `user_classes`, `user_groups`). The org hierarchy uses PostgreSQL ltree for efficient ancestor/descendant queries. Roles are classified as supervisory (can see descendants) or supervised (can only see ancestors). Super admin is a separate flag that bypasses all role checks.

Authorization pattern for single-resource endpoints: (1) check resource exists (404), (2) check super admin bypass, (3) check role-based access (403). Always 404 before 403.

## Error handling

- Services: wrap repository calls in try/catch, re-throw `ApiError`, wrap unexpected errors with logging context
- Controllers: catch `ApiError`, map to typed ts-rest responses via `toErrorResponse()`
- Use `ApiErrorMessage` enum for client-facing messages. Never leak table names, query details, or role logic.

## Key commands

```bash
npm run lint            # ESLint across monorepo
npm run format:check    # Prettier check
npm run check-types     # TypeScript type-check
npm run test            # All tests (unit + integration)
```

Backend-specific (run from `apps/backend/`):

```bash
npm run test:unit             # Unit tests only
npm run test:integration      # Integration tests (requires DB)
npm run db:migrate            # Run all pending migrations
```
