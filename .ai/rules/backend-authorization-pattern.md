---
title: Backend Authorization Pattern
description: How to implement authorization in backend code — FGA (OpenFGA) is the runtime source of truth, called from the service layer with super-admin bypass and a 404-before-403 lookup.
impact: CRITICAL
scope: backend
tags: authorization, fga, openfga, rbac, security
---

## Backend authorization pattern

> [!TIP]
> Read `architecture-authorization-model.md` for the underlying auth model (ltree, per-entity roles, supervisory/supervised, super admin, FGA model file).

Authentication lives in `AuthGuardMiddleware`. Authorization is the **service** layer's responsibility and is checked at runtime against **FGA (OpenFGA)**, not against the relational database.

The FGA authorization model (`packages/authz/authorization-model.fga`) encodes every entity type, every role, and every permission the platform recognizes. The DB junction tables (`user_orgs`, `user_classes`, `user_groups`, `user_families`) are the source of truth that _seeds_ FGA tuples — when membership rows are written or deleted, corresponding tuples are written or deleted alongside them inside the same saga / compensation boundary. The runtime authorization decision then goes through FGA via `AuthorizationService`.

This pattern replaces an earlier SQL-based approach (`listAuthorized`, `getAuthorizedById`, `AccessControlFilter`, the `repositories/access-controls/` directory). All of that infrastructure has been removed. If you see references to it in old comments, treat them as historical context — the current pattern is FGA-only.

### How it works per endpoint type

| Endpoint type                           | How authorization works                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Single resource (`GET /resources/:id`)  | `verifyResourceAccess` — repository lookup first (404), then `requirePermission(can_read, <type>:<id>)` for non-super-admins |
| Sub-resource (`GET /resources/:id/sub`) | Verify parent existence (404), then `requirePermission(can_<verb>_<sub>, <type>:<id>)`                                       |
| Collection (`GET /resources`)           | `listAccessibleObjects(can_list, <type>)` returns the set of object IDs the caller can see; repository filters by those IDs  |
| Mutation (`POST /resources/:id/...`)    | Same pattern — pick the FGA permission that semantically matches the verb (`can_create_users`, `can_create_child`, etc.)     |

### The canonical service-layer pattern

```typescript
async function verifyResourceAccess(
  authContext: AuthContext,
  resourceId: string,
): Promise<Resource> {
  const { userId, isSuperAdmin } = authContext;

  // 1. Look up the resource first — distinguishes 404 from 403
  const resource = await repository.getById({ id: resourceId });
  if (!resource) {
    throw new ApiError(ApiErrorMessage.NOT_FOUND, {
      statusCode: StatusCodes.NOT_FOUND,
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      context: { userId, resourceId },
    });
  }

  // 2. Super admins bypass FGA
  if (isSuperAdmin) return resource;

  // 3. Single FGA call — requirePermission throws ApiError(FORBIDDEN) on deny
  await authorizationService.requirePermission(
    userId,
    FgaRelation.CAN_READ,
    `${FgaType.RESOURCE}:${resourceId}`,
  );

  return resource;
}
```

The three rules that hold across every authorization check:

1. **Existence before access.** Look up the resource (or the parent, for sub-resources) before calling FGA so a missing resource returns 404, not a confusing 403.
2. **Super admin bypass first.** `isSuperAdmin` short-circuits the FGA call so super admins are never denied by a missing tuple.
3. **One FGA call, not a chain.** The FGA model already composes permissions across roles, supervisory tiers, and hierarchy. Don't re-implement that in service code — pick the right `can_*` permission for the action.

### Collection endpoints

For "list everything I can see," use `listAccessibleObjects` to ask FGA for the IDs the caller can read, then filter the DB query by those IDs:

```typescript
async function list(authContext: AuthContext, options: ListOptions) {
  const { userId, isSuperAdmin } = authContext;

  if (isSuperAdmin) {
    return repository.listAll(options);
  }

  const accessibleIds = await authorizationService.listAccessibleObjects(
    userId,
    FgaRelation.CAN_LIST,
    FgaType.RESOURCE,
  );
  if (accessibleIds.length === 0) return { items: [], totalItems: 0 };

  return repository.listByIds(accessibleIds, options);
}
```

For large collections (district admins, platform admins), use `listAccessibleObjectsStreamed` so the FGA call doesn't block the request.

### Picking the right permission

The FGA model encodes every permission explicitly. Read it (`packages/authz/authorization-model.fga`) before writing a service-layer auth check — the answer is usually already there. Common examples:

| Service operation                   | FGA permission             | Object                                             |
| ----------------------------------- | -------------------------- | -------------------------------------------------- |
| Read an administration              | `can_read`                 | `administration:<id>`                              |
| List users in a class               | `can_list_users`           | `class:<id>`                                       |
| Create a user with class membership | `can_create_users`         | `class:<id>` (parent school for class memberships) |
| Add a child to a family             | `can_create_child`         | `family:<id>`                                      |
| Read a child's scores               | `can_read_child`           | `family:<id>`                                      |
| Submit a run on behalf of a child   | `can_create_run_for_child` | `family:<id>`                                      |

`FgaRelation` and `FgaType` in `services/authorization/fga-constants.ts` expose these as typed constants — never use raw permission strings in service code.

### Incorrect

```typescript
// ❌ Direct SQL role lookup — the FGA model is the source of truth, not user_families
async function addChild(
  authContext: AuthContext,
  familyId: string,
  body: AddChildInput,
) {
  const roles = await familyRepository.getUserRolesInFamily(
    authContext.userId,
    familyId,
  );
  if (!roles.includes("parent")) throw new ApiError(/* 403 */);
  // ...
}

// ❌ No existence check — a missing resource produces a misleading 403
async function getById(authContext: AuthContext, id: string) {
  await authorizationService.requirePermission(
    authContext.userId,
    FgaRelation.CAN_READ,
    `resource:${id}`,
  );
  return repository.getById({ id }); // could return null after a successful permission check
}

// ❌ No super admin bypass — super admin can be denied if the tuple hasn't been seeded
async function getById(authContext: AuthContext, id: string) {
  const resource = await repository.getById({ id });
  if (!resource) throw new ApiError(/* 404 */);
  await authorizationService.requirePermission(
    authContext.userId,
    FgaRelation.CAN_READ,
    `resource:${id}`,
  );
  return resource;
}

// ❌ Composing permissions manually — let the FGA model do this
const isParent = await authorizationService.hasPermission(
  userId,
  "parent",
  `family:${familyId}`,
);
const isAdmin = await authorizationService.hasPermission(
  userId,
  "administrator",
  `district:${districtId}`,
);
if (!isParent && !isAdmin) throw new ApiError(/* 403 */);
```

### Correct

```typescript
async function addChild(
  authContext: AuthContext,
  familyId: string,
  body: AddChildInput,
) {
  const { userId, isSuperAdmin } = authContext;

  // 1. Existence check — 404 before 403
  const family = await familyRepository.getById({ id: familyId });
  if (!family) {
    throw new ApiError(ApiErrorMessage.NOT_FOUND, {
      statusCode: StatusCodes.NOT_FOUND,
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      context: { userId, familyId },
    });
  }

  // 2. Super admin bypass + 3. Single FGA call
  if (!isSuperAdmin) {
    await authorizationService.requirePermission(
      userId,
      FgaRelation.CAN_CREATE_CHILD,
      `${FgaType.FAMILY}:${familyId}`,
    );
  }

  // ...write changes
}
```

### Keeping FGA and the DB in sync

Membership writes go through sagas with explicit compensation: DB transaction commits → `writeTuplesOrThrow` → on failure, roll back DB rows and Firebase. This ensures there's no observable window where the DB has a role assignment but FGA doesn't, or vice versa. See `family.service.ts:create` and `user.service.ts:create` for the canonical implementations.

For drift recovery, the FGA backfill job (`fga-backfill` endpoint) re-derives all tuples from the DB junction tables — but in steady state, the saga prevents drift in the first place.

### The principle

The FGA model is the runtime source of truth for authorization. The DB junction tables are the persisted source of truth that seeds FGA tuples; they shouldn't be queried directly for authorization decisions. One FGA call per endpoint, fronted by an existence check and a super-admin bypass, is the entire pattern — anything more elaborate is usually re-implementing something FGA already composes.
