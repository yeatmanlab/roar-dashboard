---
title: Backend Error Handling
description: How errors flow through layers — services wrap and re-throw, controllers map to HTTP responses, the global handler catches everything else.
impact: HIGH
scope: backend
tags: errors, architecture, layers
---

## Backend error handling

Each layer has a specific role in error handling. Services own the try/catch and error wrapping. Controllers translate `ApiError` into typed ts-rest responses. The global error handler is the safety net for anything that slips through.

### Service layer

Wrap repository calls in try/catch. Re-throw `ApiError` instances (these are expected errors like 404 or 403). Wrap anything unexpected in a new `ApiError` with logging context:

```typescript
async function getById(authContext: AuthContext, id: string) {
  const { userId } = authContext;

  try {
    const resource = await repository.getById({ id });
    if (!resource) {
      throw new ApiError(ApiErrorMessage.NOT_FOUND, {
        statusCode: StatusCodes.NOT_FOUND,
        code: ApiErrorCode.RESOURCE_NOT_FOUND,
        context: { userId, resourceId: id },
      });
    }
    return resource;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    logger.error({ err: error, context: { userId, resourceId: id } }, 'Failed to retrieve resource');

    throw new ApiError('Failed to retrieve resource', {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.DATABASE_QUERY_FAILED,
      context: { userId, resourceId: id },
      cause: error,
    });
  }
}
```

Authorization checks that throw `ApiError` can live before the try block — there's no repository call to wrap, and the `instanceof` check would just re-throw them anyway:

```typescript
async function getLatestValid(authContext: AuthContext, groupId: string) {
  const { userId, isSuperAdmin } = authContext;

  // Auth check before try — no DB call to protect
  if (!isSuperAdmin) {
    logger.warn({ userId, groupId }, 'Non-super admin attempted access');
    throw new ApiError(ApiErrorMessage.FORBIDDEN, {
      statusCode: StatusCodes.FORBIDDEN,
      code: ApiErrorCode.AUTH_FORBIDDEN,
      context: { userId, groupId },
    });
  }

  try {
    // ... repository calls
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // ... wrap unexpected errors
  }
}
```

For parallel fetches (e.g., embed resolution with `Promise.all`), attach `.catch()` to each promise so failures throw `ApiError` immediately rather than propagating raw errors:

```typescript
const [stats, tasks] = await Promise.all([
  repository.getStats(ids).catch((err) => {
    throw new ApiError('Failed to fetch stats', {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.DATABASE_QUERY_FAILED,
      context: { userId, ids, embed: 'stats' },
      cause: err,
    });
  }),
  repository.getTasks(ids).catch((err) => {
    throw new ApiError('Failed to fetch tasks', {
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.DATABASE_QUERY_FAILED,
      context: { userId, ids, embed: 'tasks' },
      cause: err,
    });
  }),
]);
```

### Controller layer

Catch `ApiError` and convert it to a typed ts-rest response using `toErrorResponse()`. Re-throw anything else so the global handler catches it:

```typescript
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
```

The status codes passed to `toErrorResponse()` must match what the API contract declares in `responses`. If the error's status code isn't in the list, `toErrorResponse()` re-throws it to the global handler.

When multiple methods share the same error status codes (e.g., sub-resource endpoints), extract a helper:

```typescript
function handleSubResourceError(error: unknown) {
  if (error instanceof ApiError) {
    return toErrorResponse(error, [
      StatusCodes.NOT_FOUND,
      StatusCodes.FORBIDDEN,
      StatusCodes.INTERNAL_SERVER_ERROR,
    ]);
  }
  throw error;
}
```

### Global error handler

The global handler in `error-handler.ts` is the last line of defense. It catches three things:

1. **`ApiError`** — formats via `formatApiError()` and responds with the error's status code
2. **`HttpError`** (from `http-errors`) — responds with status and message
3. **Unknown errors** — logs internally, returns a generic 500 with `ApiErrorCode.INTERNAL`

Controllers and services should never rely on the global handler for expected errors — those should be caught and mapped in the appropriate layer.

### When try/catch isn't needed

Thin pass-through services that just delegate to a repository without adding authorization or business logic can skip the try/catch — the calling service is responsible for error handling. `RunsService` is an example of this: it exists as a domain boundary, not an error boundary.

### Incorrect

```typescript
// Service with business logic but no try/catch — raw DB errors bubble to global handler
async function list(authContext: AuthContext, options: ListOptions) {
  if (authContext.isSuperAdmin) return repository.listAll(options);
  const roles = rolesForPermission(Permissions.Resource.LIST);
  return repository.listAuthorized({ userId: authContext.userId, allowedRoles: roles }, options);
  // if either call throws, caller gets an untyped 500 from the global handler
}

// Controller: swallowing the error instead of re-throwing
} catch (error) {
  return { status: 500 as const, body: { error: { message: 'Something went wrong' } } };
}

// Controller: not checking instanceof before calling toErrorResponse
} catch (error) {
  return toErrorResponse(error, [StatusCodes.INTERNAL_SERVER_ERROR]); // type error if not ApiError
}
```

### The principle

Errors should be caught at the right level and enriched with context as they move up. Services add the "why" (user ID, resource ID, what operation failed). Controllers add the "how to respond" (which HTTP status codes are valid). The global handler ensures nothing ever reaches the client as a raw stack trace. The `cause` field preserves the original error for debugging without exposing it.
