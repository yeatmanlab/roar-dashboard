---
title: Backend Controller — No Business Logic
description: Controllers are pure HTTP mapping — transform data, map errors to responses, never touch the database or make authorization decisions.
impact: HIGH
scope: backend
tags: architecture, controllers, layers
---

## Backend controller — no business logic

Controllers sit between routes and services. Their job is to call the service, transform the result into an API response, and map errors to HTTP status codes. They don't make authorization decisions, don't access the database, and don't contain business rules.

### What controllers do

- Accept `AuthContext` and typed query/params — not raw `req`/`res`
- Call service methods, passing through `AuthContext`
- Transform API contract types to service layer types
- Transform DB entities to API response format (rename fields, `Date` → ISO string, attach embeds)
- Map `ApiError` to typed ts-rest responses via `toErrorResponse()`
- Use `as const` on status codes for ts-rest type narrowing

### What controllers don't do

- Authorization checks (service layer)
- Business rule validation (service layer)
- Database queries (repository layer)
- Error creation — services throw `ApiError`, controllers just map them

### Incorrect

```typescript
// Authorization in the controller — belongs in the service
get: async (authContext: AuthContext, id: string) => {
  const roles = rolesForPermission(Permissions.Resource.READ);
  const item = await repository.getAuthorizedById({ userId: authContext.userId, allowedRoles: roles }, id);
  if (!item) throw new ApiError(ApiErrorMessage.FORBIDDEN, { /* ... */ });
  return { status: StatusCodes.OK as const, body: { data: item } };
},

// Database access in the controller — belongs in the repository
list: async (authContext: AuthContext, query: ListQuery) => {
  const items = await db.select().from(resources).where(/* ... */);
  return { status: StatusCodes.OK as const, body: { data: items } };
},
```

### Correct

```typescript
export const MyResourceController = {
  get: async (authContext: AuthContext, id: string) => {
    try {
      const item = await service.getById(authContext, id);
      return {
        status: StatusCodes.OK as const,
        body: { data: transformItem(item) },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.NOT_FOUND,
          StatusCodes.FORBIDDEN,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },

  list: async (authContext: AuthContext, query: ListQuery) => {
    try {
      const { page, perPage, sortBy, sortOrder, embed, status } = query;
      const result = await service.list(authContext, {
        page,
        perPage,
        sortBy,
        sortOrder,
        embed,
        ...(status && { status }),
      });
      return {
        status: StatusCodes.OK as const,
        body: {
          data: {
            items: result.items.map(transformItem),
            pagination: {
              page,
              perPage,
              totalItems: result.totalItems,
              totalPages: Math.ceil(result.totalItems / perPage),
            },
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },
};
```

### Transform functions

Define private helpers to map DB entities to the API contract. Keep them in the controller file:

```typescript
function transformItem(entity: DbEntity): ApiEntity {
  return {
    id: entity.id,
    name: entity.name,
    createdAt: entity.createdAt.toISOString(),
  };
}
```

When multiple sub-resource endpoints share the same pagination response shape, extract a helper:

```typescript
function handleSubResourceResponse<T>(
  result: { items: T[]; totalItems: number },
  page: number,
  perPage: number,
  mapItem: (item: T) => unknown,
) {
  return {
    status: StatusCodes.OK as const,
    body: {
      data: {
        items: result.items.map(mapItem),
        pagination: {
          page,
          perPage,
          totalItems: result.totalItems,
          totalPages: Math.ceil(result.totalItems / perPage),
        },
      },
    },
  };
}
```

### The principle

Controllers are the thinnest layer in the stack. When a controller contains no logic beyond data transformation and error mapping, you can test it by mocking the service — no database, no auth system, no Express. If you find yourself writing `if` statements that aren't about error handling or response shaping, the logic probably belongs in the service.
