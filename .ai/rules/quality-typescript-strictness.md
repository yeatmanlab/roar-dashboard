---
title: TypeScript Strictness
description: All TypeScript packages use strict mode — as const for literals, @ts-expect-error over @ts-ignore, avoid as any, prefer typed APIs over raw strings.
impact: MEDIUM
scope: shared
tags: typescript, types, strictness, conventions
---

## TypeScript strictness

All TypeScript packages in the monorepo (backend, api-contract, assessment-sdk) share `packages/config-typescript/base.json` with `strict: true` plus additional flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`). These aren't negotiable — work with the type system, don't fight it.

### Incorrect

```typescript
// @ts-ignore — use @ts-expect-error with an explanation instead
// @ts-ignore
middleware: [AuthGuardMiddleware],

// as any — avoid in both production and test code
const result = items as any;

// Raw strings where typed constants exist
const roles = rolesForPermission('administrations.read');

// Mixing type-only and runtime imports on one line
import { type EnrolledUser, UserRole } from '@roar-dashboard/api-contract';
```

### Correct

**`as const` for literal types:**

```typescript
// Status codes — enables ts-rest type narrowing
return { status: StatusCodes.OK as const, body: { data: result } };

// Constant objects — derive types from values, not the other way around
export const Permissions = {
  Administrations: {
    LIST: 'administrations.list',
    READ: 'administrations.read',
  },
} as const;

export type Permission = DeepValues<typeof Permissions>;
```

Use `as const satisfies` when you need both a literal type and compile-time validation against a constraint:

```typescript
const SORT_COLUMNS = {
  createdAt: administrations.createdAt,
  name: administrations.name,
} as const satisfies Record<SortFieldType, Column>;
```

**`import type` for type-only imports:**

Separate type imports from runtime imports using `import type` on its own line:

```typescript
// Types on their own line, runtime values on theirs
import type { AuthContext, ListOptions } from '../types/auth-context';
import { StatusCodes } from 'http-status-codes';

// When a module provides both, split into two imports
import type { EnrolledUser, EnrolledUsersSortFieldType } from '@roar-dashboard/api-contract';
import { UserRole, SortOrder } from '@roar-dashboard/api-contract';

// When everything from a module is type-only, use a single import type
import type { AccessControlFilter } from './utils/parse-access-control-filter.utils';
```

Don't use the inline `type` keyword syntax (`import { type Foo, Bar }`). The codebase uses separate `import type` lines consistently — follow the existing convention.

A quick test: if removing the import doesn't cause a runtime error (only a type error), it should be `import type`.

**`@ts-expect-error` with explanation:**

```typescript
// @ts-expect-error - Express v4/v5 types mismatch in monorepo
middleware: [AuthGuardMiddleware],
```

Always explain *why* the suppression is needed. `@ts-ignore` is never used — `@ts-expect-error` will error if the suppression becomes unnecessary (e.g., after a type fix).

**Typed constants over raw strings:**

```typescript
// Permission is a union of all literal permission strings — typos become compile errors
const roles = rolesForPermission(Permissions.Administrations.READ);
```

This applies broadly: use typed enums and constants instead of raw strings wherever the set of valid values is known at compile time.

**Avoid `as any`** — even in tests. Use typed mock factories instead of casting inline mocks. See `backend-testing-unit-vs-integration.md` for the pattern.

### Backend-specific patterns

**Type-safe Drizzle operators over raw SQL:**

```typescript
const result = await db
  .select()
  .from(administrations)
  .where(and(
    eq(administrations.id, id),
    gte(administrations.dateStart, sql`NOW()`),
  ));
```

Reserve `sql` template literals for expressions that can't be expressed with Drizzle operators (e.g., `NOW()`, ltree functions).

**Enums derived from database schema** — not defined independently:

```typescript
import { userRoleEnum } from '../db/schema/enums';
export const UserRole = pgEnumToConst(userRoleEnum);
export type UserRole = (typeof userRoleEnum.enumValues)[number];
```

**Shared types** used across multiple layers live in `src/types/` as the single source of truth:

- **`auth-context.ts`** — `AuthContext` type (`{ userId, isSuperAdmin }`)
- **`express.d.ts`** — augments Express `Request` with `user?: AuthContext`

### Non-null assertions (`!`)

Non-null assertions are used in three specific contexts:

1. **Route handlers** — after `AuthGuardMiddleware`, `req.user` is guaranteed:
   ```typescript
   handler: async ({ req }) =>
     Controller.list({ userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin }, query),
   ```

2. **Integration tests** — array indexing with `noUncheckedIndexedAccess`:
   ```typescript
   expect(result.items[0]!.name).toBe('Expected');
   ```

3. **Guaranteed non-null after guard** — after a null check or throw:
   ```typescript
   const user = await repo.getById({ id });
   if (!user) throw new ApiError(/* ... */);
   // user is guaranteed non-null from here
   ```

### The principle

Strict TypeScript catches bugs at compile time that would otherwise surface in production. `as const` turns runtime values into compile-time types. `@ts-expect-error` is self-cleaning — it tells you when a workaround is no longer needed. Every exception (`as any`, `!`, `@ts-expect-error`) is documented and scoped to the narrowest possible context.
