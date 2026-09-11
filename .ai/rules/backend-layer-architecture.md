---
title: Backend Layer Architecture
description: Every backend endpoint is built across 5 layers, each with a clear responsibility. Here's the order and what goes where.
impact: CRITICAL
scope: backend
tags: architecture, endpoints, layers
---

## Backend layer architecture

Backend endpoints are built across 5 layers, each owning a specific concern. When adding a new endpoint, implement them in the order below — the contract defines the types that flow through every subsequent layer.

### The 5 layers

Implement in this order:

| # | Layer | Location |
|---|-------|----------|
| 1 | API Contract | `packages/api-contract/src/v1/<resource>/` |
| 2 | Route | `apps/backend/src/routes/<resource>.ts` |
| 3 | Controller | `apps/backend/src/controllers/<resource>.controller.ts` |
| 4 | Service | `apps/backend/src/services/<resource>/<resource>.service.ts` |
| 5 | Repository | `apps/backend/src/repositories/<resource>.repository.ts` |

Plus registration in:
- `packages/api-contract/src/v1/index.ts` — add contract to router + re-export
- `apps/backend/src/routes/index.ts` — call `register<Resource>Routes(router)`

### Layer responsibilities

| Layer | Does | Does NOT |
|-------|------|----------|
| **Contract** | Zod schemas, HTTP method/path, request/response types | Business logic, DB types |
| **Route** | Middleware application, `req.user` extraction, delegate to controller | Any logic beyond extracting auth context |
| **Controller** | Transform DB entities to API format, map `ApiError` to HTTP responses | DB access, authorization checks, business logic |
| **Service** | Authorization logic, business rules, embed resolution, error wrapping | HTTP status codes in return values, DB queries, response transformation |
| **Repository** | Database queries, SQL, Drizzle ORM, access control joins | Authorization decisions, HTTP concerns |

### Incorrect

```typescript
// Mixing authorization and DB access into the route handler
handler: async ({ req, query }) => {
  const user = req.user!;
  const roles = rolesForPermission(Permissions.Resource.LIST);
  const items = await repository.listAuthorized({ userId: user.userId, allowedRoles: roles }, query);
  return { status: 200, body: { data: items } };
}
```

### Correct

Each layer has a single responsibility. Here's how a `list` endpoint flows through all five:

**Route** — extract auth context, delegate to controller:
```typescript
handler: async ({ req, query }) =>
  MyController.list(
    { userId: req.user!.userId, isSuperAdmin: req.user!.isSuperAdmin },
    query,
  ),
```

**Controller** — call service, transform result, handle errors:
```typescript
list: async (authContext: AuthContext, query: ListQuery) => {
  try {
    const result = await service.list(authContext, query);
    return { status: StatusCodes.OK as const, body: { data: transform(result) } };
  } catch (error) {
    if (error instanceof ApiError) return toErrorResponse(error, [StatusCodes.INTERNAL_SERVER_ERROR]);
    throw error;
  }
},
```

**Service** — authorization + business logic:
```typescript
async function list(authContext: AuthContext, options: ListOptions) {
  const { userId, isSuperAdmin } = authContext;
  if (isSuperAdmin) return repository.listAll(queryParams);
  const allowedRoles = rolesForPermission(Permissions.Resource.LIST);
  return repository.listAuthorized({ userId, allowedRoles }, queryParams);
}
```

**Repository** — data access with optional authorization filtering:
```typescript
async listAll(options: ListOptions): Promise<PaginatedResult<Resource>> {
  // No auth filtering — used only for super admins
  return this.getAll({ page, perPage, orderBy, where: statusFilter });
}

async listAuthorized(
  accessControlFilter: AccessControlFilter,
  options: ListOptions,
): Promise<PaginatedResult<Resource>> {
  // Build the access control subquery (see access controls below)
  const accessible = this.accessControls
    .buildUserResourceIdsQuery(accessControlFilter)
    .as('accessible');

  // Join resource table against the subquery — filtering and fetching in one round-trip
  return this.db
    .selectDistinct({ resource: resources })
    .from(resources)
    .innerJoin(accessible, eq(resources.id, accessible.resourceId))
    .where(statusFilter)
    .orderBy(sortDirection)
    .limit(perPage)
    .offset(offset);
}
```

**Access controls** (`repositories/access-controls/`) — build the authorization subquery:
```typescript
// Builds a UNION of paths the user can access:
// - Ancestor paths (all roles): resources on the user's entity or above
// - Descendant paths (supervisory roles only): resources on child entities
buildUserResourceIdsQuery(filter: AccessControlFilter) {
  const { userId, allowedRoles } = parseAccessControlFilter(filter);

  // Path 1: User's org memberships → resources on that org or ancestors
  // Path 2: User's class memberships → resources on the class's school or ancestors
  // Path 3: User's class memberships → resources directly on that class
  // Path 4: User's group memberships → resources directly on that group
  const ancestorUnion = union(path1, path2, path3, path4);

  // Skip descendant paths if user has no supervisory roles
  const supervisoryRoles = filterSupervisoryRoles(allowedRoles);
  if (supervisoryRoles.length === 0) return ancestorUnion;

  // Path 5: User's org → resources on descendant orgs
  // Path 6: User's org → resources on classes within the org tree
  return union(ancestorUnion, path5, path6);
}
```

### The principle

Each layer should be testable in isolation. Services can be unit-tested by injecting mock repositories. Controllers can be tested by mocking services. When concerns are separated, you never need a full Express setup just to test a permission check, or a real database just to test response transformation.
