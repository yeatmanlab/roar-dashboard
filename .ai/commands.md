# Build, Test & Development Commands

## Monorepo (run from repo root)

All root commands use Turbo to run across packages.

```bash
npm run dev             # Start all dev servers (backend + dashboard + packages)
npm run build           # Build all packages and apps
npm run lint            # ESLint across the monorepo
npm run lint:fix        # ESLint with auto-fix
npm run format          # Prettier format
npm run format:check    # Prettier check (CI uses this)
npm run check-types     # TypeScript type-check across all packages
npm run test            # Run all tests (unit + integration)
npm run test:watch      # Run tests in watch mode
npm run clean           # Remove build artifacts (dist, node_modules, .turbo)
```

## Backend (`apps/backend/`)

### Development

```bash
npm run dev             # Start backend dev server (rollup watch mode)
npm run build           # Production build
npm run start           # Start built server (node dist/server.js)
```

### Lint, Format, Types

```bash
npm run lint            # ESLint
npm run lint:fix        # ESLint with auto-fix
npm run format          # Prettier format
npm run format:check    # Prettier check
npm run check-types     # TypeScript type-check (tsc --noEmit)
```

### Testing

Unit and integration tests run as separate Vitest projects. Integration tests use a real Postgres database.

```bash
npm run test            # All tests (unit + integration)
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only (requires DB)
npm run test:watch      # All tests in watch mode
npm run test:unit:watch # Unit tests in watch mode
npm run test:integration:watch # Integration tests in watch mode
```

Run a specific test file:

```bash
npx vitest run src/services/administration/administration.service.test.ts --project unit
npx vitest run src/repositories/administration.repository.integration.test.ts --project integration
```

Run a specific test by name:

```bash
npx vitest run src/services/task/task.service.test.ts --project unit -t "returns 403"
```

### Database

Two databases: core (orgs, users, administrations) and assessment (runs, trials, scores).

```bash
npm run db:migrate        # Run all pending migrations (core + assessment)
npm run db:migrate:core   # Core DB migrations only
npm run db:migrate:assess # Assessment DB migrations only
npm run db:gen:core       # Generate a new core migration from schema changes
npm run db:gen:assess     # Generate a new assessment migration from schema changes
npm run db:push:core      # Push core schema directly (dev only, no migration file)
npm run db:push:assess    # Push assessment schema directly (dev only, no migration file)
npm run db:studio:core    # Open Drizzle Studio for core DB
npm run db:studio:assess  # Open Drizzle Studio for assessment DB
```

## Dashboard (`apps/dashboard/`)

### Development

```bash
npm run dev             # Start Vite dev server
npm run build           # Build for production
npm run preview         # Preview production build locally
```

### Lint, Format, Types

```bash
npm run lint            # ESLint
npm run lint:fix        # ESLint with auto-fix
npm run format          # Prettier format
npm run format:check    # Prettier check
```

### Testing

```bash
npm run test            # Vitest (unit + component)
npm run test:watch      # Vitest in watch mode
npm run cypress:open    # Open Cypress for E2E / component tests
```

## Packages

### api-contract (`packages/api-contract/`)

```bash
npm run build           # Build (rollup + type declarations)
npm run dev             # Watch mode
npm run check-types     # Type-check
npm run lint            # ESLint
npm run format:check    # Prettier check
```

### assessment-sdk (`packages/assessment-sdk/`)

```bash
npm run build           # Build (rollup + type declarations)
npm run test            # Vitest
npm run test:coverage   # Vitest with coverage report
npm run typecheck       # Type-check
```

## Pre-push checklist

Run these from the repo root before pushing:

```bash
npm run lint            # ESLint
npm run format:check    # Prettier
npm run check-types     # TypeScript
npm run test            # Unit + integration tests
```

See [quality-pr-creation](rules/quality-pr-creation.md) for the full PR workflow.
