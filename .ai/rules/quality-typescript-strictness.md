---
title: TypeScript Strictness
description: The backend uses strict TypeScript — as const for literals, @ts-expect-error over @ts-ignore, type-safe Drizzle operators, and Permission types over raw strings.
impact: MEDIUM
scope: backend
tags: typescript, types, strictness, conventions
---

## TypeScript strictness

The backend runs with `strict: true` plus additional strictness flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`). These aren't negotiable — work with the type system, don't fight it.

### Incorrect

```typescript
// @ts-ignore — use @ts-expect-error with an explanation instead
// @ts-ignore
middleware: [AuthGuardMiddleware],

// as any in production code — only acceptable in tests
const result = items as any;

// Raw permission strings — use the typed constant
const roles = rolesForPermission('administrations.read');

// Raw SQL when Drizzle operators exist
const result = await db.execute(sql`SELECT * FROM orgs WHERE id = ${id}`);
```

### Correct

**`as const` for literal types:**

```typescript
// Status codes — enables ts-rest type narrowing
return { status: StatusCodes.OK as const, body: { data: result } };

// Sort column mappings
const SORT_COLUMNS = {
  createdAt: administrations.createdAt,
  name: administrations.name,
} as const satisfies Record<SortFieldType, Column>;

// Permission constants — the Permission type is derived from this object
export const Permissions = {
  Administrations: {
    LIST: 'administrations.list',
    READ: 'administrations.read',
  },
} as const;

export type Permission = DeepValues<typeof Permissions>;
```

**`@ts-expect-error` with explanation:**

```typescript
// @ts-expect-error - Express v4/v5 types mismatch in monorepo
middleware: [AuthGuardMiddleware],
```

Always explain *why* the suppression is needed. `@ts-ignore` is never used — `@ts-expect-error` will error if the suppression becomes unnecessary (e.g., after a type fix).

**Type-safe Drizzle operators over raw SQL:**

```typescript
// Prefer Drizzle's typed operators
const result = await db
  .select()
  .from(administrations)
  .where(and(
    eq(administrations.id, id),
    gte(administrations.dateStart, sql`NOW()`),
  ));
```

Reserve `sql` template literals for expressions that can't be expressed with Drizzle operators (e.g., `NOW()`, ltree functions).

**Permission type over raw strings:**

```typescript
// Permission is a union of all literal permission strings
const roles = rolesForPermission(Permissions.Administrations.READ);
```

Typos in permission strings become compile errors.

**`as any` only in tests, with ESLint disable:**

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = AdministrationService({ repository: mockRepo as any });
```

Mock injection in unit tests is the one place `as any` is acceptable. Always add the inline ESLint disable comment.

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

### Shared types

Types used across multiple layers live in `src/types/` as the single source of truth:

- **`auth-context.ts`** — `AuthContext` type (`{ userId, isSuperAdmin }`) used by routes, controllers, and services
- **`express.d.ts`** — augments Express `Request` with `user?: AuthContext`

Enums are derived from database schema types, not defined independently:

```typescript
import { userRoleEnum } from '../db/schema/enums';
export const UserRole = pgEnumToConst(userRoleEnum);
export type UserRole = (typeof userRoleEnum.enumValues)[number];
```

### The principle

Strict TypeScript catches bugs at compile time that would otherwise surface in production. `as const` turns runtime values into compile-time types. `@ts-expect-error` is self-cleaning — it tells you when a workaround is no longer needed. Type-safe Drizzle operators prevent SQL injection and column name typos. The `Permission` type turns misspelled permission strings into compile errors. Every exception (`as any`, `!`, `@ts-expect-error`) is documented and scoped to the narrowest possible context.
