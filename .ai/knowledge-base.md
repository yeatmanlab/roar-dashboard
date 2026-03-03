# ROAR Domain Knowledge

This document captures domain-specific context that AI agents need to work effectively in the ROAR codebase. It complements the engineering rules in [.ai/rules/](rules/README.md) with background knowledge that does not fit neatly into a single rule.

## What is ROAR?

ROAR (Rapid Online Assessment of Reading) is an educational assessment platform. Students take web-based reading assessments administered by schools and districts. Teachers, school admins, and district admins view results through a dashboard. The platform handles student data subject to FERPA, which means authorization correctness and data isolation are non-negotiable.

## Entity Hierarchy

The entity model follows the OneRoster v1.1/v1.2 specification.

### Organizations

Organizations are hierarchical. The primary levels are district and school, though the schema also supports national, state, local, and department types. Each org has an optional `parentOrgId` for tree relationships and a `path` column using PostgreSQL's ltree extension for efficient ancestor/descendant queries.

Path format: `{org_type}_{uuid_with_underscores}` segments separated by dots. For example: `district_550e8400_e29b_41d4_a716_446655440000.school_a1b2c3d4_5e6f_7a8b_9c0d_1e2f3a4b5c6d`.

Org paths are set automatically by database triggers on insert. When an org is reparented, descendant paths are updated automatically and cycle detection prevents circular hierarchies.

### Classes

Classes belong to schools. Each class stores a `schoolId`, a `districtId`, and an `orgPath` (ltree) copied from the parent school's path. This lets access control queries traverse from a class up through the school and district in a single ltree operation.

### Groups

Groups are flat, non-hierarchical entities. They have no parent relationships and exist alongside the org/class tree rather than within it.

### Users

Users do not have a global role. Instead, roles are assigned per entity through junction tables: `user_orgs`, `user_classes`, and `user_groups`. The same person can be a teacher at one school and an administrator at a district. See the authorization model rule for how this affects access control: [architecture-authorization-model](rules/architecture-authorization-model.md).

### Administrations

Administrations represent assessment sessions assigned to entities at any level. Junction tables (`administration_orgs`, `administration_classes`, `administration_groups`) connect administrations to the entities where they are assigned. A single administration can span multiple schools or classes.

## OneRoster Roles

All roles come from the `user_role` database enum, derived into TypeScript via `pgEnumToConst()`.

**All roles:** administrator, aide, counselor, district_administrator, guardian, parent, principal, proctor, relative, site_administrator, student, system_administrator, teacher.

### Supervisory vs. supervised

Roles are classified in `apps/backend/src/constants/role-classifications.ts`:

**Supervisory roles** (can see descendant entities): administrator, aide, counselor, district_administrator, principal, proctor, site_administrator, system_administrator, teacher.

**Supervised roles** (can only see ancestor entities): student, guardian, parent, relative.

The utility `hasSupervisoryRole(roles)` checks whether a user holds any supervisory role. Access control subqueries skip descendant path lookups entirely when the user has no supervisory roles.

### Permission tiers

Role-to-permission mappings live in `apps/backend/src/constants/role-permissions.ts`. The `rolesForPermission()` function returns which roles grant a given permission (e.g., `Permissions.Administrations.LIST`). The main tiers are:

- **System/Site/District admins**: Full read access across administrations, classes, groups, orgs, users, reports, and task variants.
- **Educators** (principal, counselor, teacher, aide, proctor): Same read access as admins.
- **Caregivers** (guardian, parent, relative): Read access to administrations and orgs, plus profile, reports, and task launching.
- **Students**: Read access to administrations and profile, plus task launching and task variant listing.

## Two-Database Architecture

The backend connects to two separate PostgreSQL databases.

### Core database

Stores rostering and administration data: users, orgs, classes, groups, courses, administrations, tasks, task variants, agreements, and all junction/relationship tables. Accessed via `CoreDbSchema` and `CoreDbClient`.

### Assessment database

Stores assessment execution data: runs (user assessment sessions), run trials (individual assessment items), run trial interactions (user responses during trials), and run scores (computed results). Accessed via `AssessmentDbSchema` and `AssessmentDbClient`.

### Practical implications

- Repositories must use the correct client. Most repositories use `CoreDbClient`, but `RunsRepository` and related repositories use `AssessmentDbClient`.
- Database pools must be initialized before any queries. The backend calls `initializeDatabasePools()` at startup.
- Environment variables: `CORE_DATABASE_URL` and `ASSESSMENT_DATABASE_URL` (or Cloud SQL Connector for production).
- Drizzle migration commands are split: `db:migrate:core` vs. `db:migrate:assess`, `db:gen:core` vs. `db:gen:assess`.

## Firebase Authentication

Authentication uses Firebase Admin SDK for JWT validation. The flow:

1. The client sends a Firebase JWT in the Authorization header.
2. `AuthGuardMiddleware` extracts and validates the token.
3. The middleware looks up the user in PostgreSQL by their Firebase `authId`.
4. A minimal `AuthContext` is attached to `req.user`:

```typescript
{
  userId: string;        // PostgreSQL user UUID
  isSuperAdmin: boolean; // Bypasses all role-based checks
}
```

Authentication (identity verification) happens in middleware. Authorization (permission checks) happens in the service and repository layers. Super admin status is independent of junction table roles and is always checked first in every authorization flow.

## Database Triggers and Gotchas

### ltree path triggers

Defined in migration `0052_add_ltree_path_triggers.sql`:

- **Org insert**: `trg_orgs_compute_path_insert` automatically generates the `path` value. Do not set `path` manually in code.
- **Org reparent**: `trg_orgs_update_descendant_paths` updates all descendant paths and validates against cycles.
- **Class insert**: `trg_classes_compute_org_path_insert` copies the school's path to the class's `orgPath`.
- **Class update**: `trg_classes_update_org_path` updates the class path when the school changes.

### Rostered entity deletion protection

Defined in migration `0038_add_prevent_rostered_entity_delete_fn.sql`:

The `prevent_rostered_entity_delete` trigger blocks DELETE on users, orgs, classes, courses, and groups if they have an entry in `rostering_provider_ids`. Entities must be removed from the rostering system before they can be deleted manually.

### updated_at triggers

All tables have a `set_updated_at` trigger that automatically sets the `updated_at` timestamp on every modification.

### Soft deletes

The assessment `runs` table supports soft deletion via `deletedAt` and `deletedBy` columns. A database constraint (`runs_deleted_by_required`) enforces that `deletedBy` is set whenever `deletedAt` is set. Core database tables (orgs, users, classes, groups, administrations) use physical deletion protected by the rostered entity triggers described above.

When querying runs, ensure that soft-deleted records are excluded unless the query explicitly needs them. The `BaseRepository.delete()` method performs a hard delete, so soft deletion of runs requires a separate update setting `deletedAt` and `deletedBy`.

## Monorepo Package Graph

```
packages/config-typescript/    (shared strict TypeScript config)
       |
       v
packages/api-contract/         (ts-rest + Zod contracts, shared types)
       |
       +---> packages/assessment-sdk/   (assessment client SDK)
       |
       +---> apps/backend/              (Express API server, Drizzle ORM)
       |
       +---> apps/dashboard/            (Vue 3 frontend)
```

### packages/api-contract

The single source of truth for request/response types. All Zod schemas and ts-rest contracts live here. Both the backend and dashboard derive their types from this package. Changes here affect all consumers.

Dependencies: `@ts-rest/core`, `zod`.

### packages/assessment-sdk

A client SDK for assessment operations. Depends on `api-contract` for shared types. Used by the dashboard and by external assessment tasks.

Dependencies: `@ts-rest/core`, `@roar-dashboard/api-contract`.

### apps/backend

Implements the 5-layer architecture (Contract, Route, Controller, Service, Repository). Uses Drizzle ORM for database access, Express for HTTP, Pino for structured logging, and Firebase Admin for auth.

Dependencies: `@roar-dashboard/api-contract`, `@ts-rest/express`, `drizzle-orm`, `firebase-admin`, `pg`, `pino`, `zod`.

### apps/dashboard

The user-facing Vue 3 application. Uses Pinia for client state (auth, session) and TanStack Query for server state (API data). The dashboard is migrating from legacy Firestore queries to the new ts-rest API client built on `api-contract`.

Dependencies: `@roar-dashboard/api-contract`, `@roar-dashboard/assessment-sdk`, Vue 3, PrimeVue, Pinia, TanStack Query, TailwindCSS.

### packages/config-typescript

Shared TypeScript configuration with `strict: true` plus additional strictness flags: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`. All TypeScript packages extend this config.

## Key File Locations

| Domain | Location | Purpose |
|--------|----------|---------|
| Role enum | `apps/backend/src/db/schema/enums.ts` | Source of truth for all user roles |
| Role classification | `apps/backend/src/constants/role-classifications.ts` | SUPERVISORY_ROLES, SUPERVISED_ROLES |
| Role permissions | `apps/backend/src/constants/role-permissions.ts` | Role-to-permission mapping, rolesForPermission() |
| Org schema | `apps/backend/src/db/schema/core/orgs.ts` | Hierarchical org structure with ltree |
| Class schema | `apps/backend/src/db/schema/core/classes.ts` | Class structure with orgPath |
| Group schema | `apps/backend/src/db/schema/core/groups.ts` | Flat group structure |
| DB clients | `apps/backend/src/db/clients.ts` | CoreDbClient, AssessmentDbClient |
| Auth middleware | `apps/backend/src/middleware/auth-guard/auth-guard.middleware.ts` | Firebase JWT validation |
| AuthContext type | `apps/backend/src/types/auth-context.ts` | AuthContext definition |
| ltree triggers | `apps/backend/migrations/core/0052_add_ltree_path_triggers.sql` | Path auto-population |
| Delete protection | `apps/backend/migrations/core/0038_add_prevent_rostered_entity_delete_fn.sql` | Rostered entity guard |
| TypeScript config | `packages/config-typescript/base.json` | Shared strict TS config |
