---
title: Backend Authorization Pattern
description: How to implement authorization in backend code — always in the service/repository layer, never in middleware.
impact: CRITICAL
scope: backend
tags: authorization, rbac, security
---

## Backend authorization pattern

> [!TIP]
> Read `architecture-authorization-model.md` for the underlying auth model (ltree, per-entity roles, supervisory/supervised, super admin).

In contrary to authentication, which is handled in a dedicated middleware, authorization for the ROAR backend lives in the service and repository layers.

The reason for that being that determining whether a user can access a given resource requires joining across multiple tables — junction tables (`user_orgs`, `user_classes`, `user_groups`), the org hierarchy (via ltree), and role mappings — all in a single query.

This is only practical in the repository layer, where it can be combined with the data fetch itself rather than split across middleware and service.

### How it works per endpoint type

| Endpoint type | How authorization works |
|---------------|----------------------|
| Collection (`GET /resources`) | Repository filters to only accessible resources in a single query (`listAuthorized`) |
| Single resource (`GET /resources/:id`) | `verifyResourceAccess` — lookup first, then check access |
| Sub-resource (`GET /resources/:id/children`) | Verify parent access first, then check role-based restrictions |

### Repository method naming convention

Repositories provide paired methods — an unrestricted variant for super admins and an authorized variant that filters by user access:

| Pattern | Used by | Example |
|---------|---------|---------|
| `listAll(options)` | Super admins | Returns all resources, no access filtering |
| `listAuthorized(filter, options)` | Regular users | Joins against access control subquery |
| `getAuthorizedById(filter, id)` | Regular users | Verifies user can access a specific resource |
| `getXxxByParentId(parentId, options)` | Super admins | Unrestricted sub-resource listing |
| `getAuthorizedXxxByParentId(filter, parentId, options)` | Regular users | Filtered sub-resource listing |

The `filter` parameter is an `AccessControlFilter` (`{ userId, allowedRoles }`), validated via Zod schema in `parseAccessControlFilter()`.

### How access control queries work

The `repositories/access-controls/` directory contains classes that build the SQL subqueries powering the authorized repository methods. For example, `AdministrationAccessControls.buildUserAdministrationIdsQuery()` builds a UNION of multiple paths:

**Ancestor paths (all roles):** Starting from the user's org/class/group memberships, find resources assigned to the same entity or any ancestor in the ltree hierarchy. This is the baseline — a student in Class X sees administrations on Class X, School A, and the District.

**Descendant paths (supervisory roles only):** Additionally find resources assigned to descendant entities. A district admin sees administrations on child schools and their classes. These paths are skipped entirely when the user has no supervisory roles (optimization via `filterSupervisoryRoles`).

The resulting subquery is used as an `INNER JOIN` in the repository's data query, so filtering and fetching happen in a single round-trip.

### incorrect

```typescript
// Problem 1: No existence check before auth — if the resource doesn't exist,
// the authorized query returns null and the user gets a misleading 403 instead of 404
async function getById(authContext: AuthContext, id: string) {
  const allowedRoles = rolesForPermission(Permissions.Resource.READ);
  const authorized = await repository.getAuthorizedById({ userId: authContext.userId, allowedRoles }, id);
  if (!authorized) {
    throw new ApiError(ApiErrorMessage.FORBIDDEN, {
      statusCode: StatusCodes.FORBIDDEN,
      code: ApiErrorCode.AUTH_FORBIDDEN,
    });
  }
  return authorized;
}

// Problem 2: No super admin bypass — super admins are forced through
// the role-based access check, which may incorrectly deny them
async function getById(authContext: AuthContext, id: string) {
  const resource = await repository.getById({ id });
  if (!resource) throw new ApiError(/* 404 */);

  const allowedRoles = rolesForPermission(Permissions.Resource.READ);
  const authorized = await repository.getAuthorizedById(
    { userId: authContext.userId, allowedRoles }, id,
  );
  if (!authorized) throw new ApiError(/* 403 */);
  return authorized;
}
```

### correct

**Route layer** — authentication only (identity verification):
```typescript
middleware: [AuthGuardMiddleware]
```

**Service layer** — authorization for single-resource endpoints:

Extract a `verifyResourceAccess` helper when multiple methods need the same access check:

```typescript
async function verifyResourceAccess(authContext: AuthContext, resourceId: string): Promise<Resource> {
  const { userId, isSuperAdmin } = authContext;

  // 1. Look up resource first — distinguishes 404 from 403
  const resource = await repository.getById({ id: resourceId });
  if (!resource) {
    throw new ApiError('Resource not found', {
      statusCode: StatusCodes.NOT_FOUND,
      code: ApiErrorCode.RESOURCE_NOT_FOUND,
      context: { userId, resourceId },
    });
  }

  // 2. Super admins bypass access checks
  if (isSuperAdmin) return resource;

  // 3. Check access via org hierarchy joins
  const allowedRoles = rolesForPermission(Permissions.Resource.READ);
  const authorized = await repository.getAuthorizedById({ userId, allowedRoles }, resourceId);
  if (!authorized) {
    logger.warn({ userId, resourceId }, 'User attempted access without permission');
    throw new ApiError(ApiErrorMessage.FORBIDDEN, {
      statusCode: StatusCodes.FORBIDDEN,
      code: ApiErrorCode.AUTH_FORBIDDEN,
      context: { userId, resourceId },
    });
  }

  return authorized;
}
```

**Service layer** — authorization for collection endpoints:
```typescript
async function list(authContext: AuthContext, options: ListOptions) {
  const { userId, isSuperAdmin } = authContext;
  const queryParams = { page: options.page, perPage: options.perPage, /* ... */ };

  if (isSuperAdmin) {
    return repository.listAll(queryParams);
  }
  const allowedRoles = rolesForPermission(Permissions.Resource.LIST);
  return repository.listAuthorized({ userId, allowedRoles }, queryParams);
}
```

**Service layer** — authorization for sub-resource endpoints:

For sub-resources, verify parent access first, then check role-based restrictions. Extract an `authorizeSubResourceAccess` helper when multiple sub-resource methods share the same pattern:

```typescript
async function authorizeSubResourceAccess(authContext: AuthContext, parentId: string): Promise<void> {
  const { userId, isSuperAdmin } = authContext;

  // Verify parent resource exists and user has access (throws 404/403)
  await verifyResourceAccess(authContext, parentId);

  // Super admins don't need further checks
  if (isSuperAdmin) return;

  // Sub-resource listing requires a supervisory role
  const userRoles = await repository.getUserRolesForResource(userId, parentId);
  if (!hasSupervisoryRole(userRoles)) {
    logger.warn({ userId, parentId, userRoles }, 'Supervised user attempted sub-resource listing');
    throw new ApiError(ApiErrorMessage.FORBIDDEN, {
      statusCode: StatusCodes.FORBIDDEN,
      code: ApiErrorCode.AUTH_FORBIDDEN,
    });
  }
}
```

### Why this matters

Authorization bugs are security vulnerabilities. Putting auth in middleware means you either duplicate complex org hierarchy queries or skip them entirely. The lookup-before-auth pattern ensures correct status codes — a missing resource returns 404 regardless of the user's permissions, rather than a misleading 403. Every authorization decision in this codebase follows this service-layer pattern; deviating creates inconsistent security boundaries.
