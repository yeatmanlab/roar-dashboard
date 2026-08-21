---
title: Backend Error Message Security
description: API error messages must never reveal internals. Log the details, return generic messages to clients.
impact: CRITICAL
scope: backend
tags: security, errors, authorization
---

## Backend error message security

Every `ApiError` message ends up in the API response — `formatApiError()` sends `{ message, code, traceId }` to the
client. A message like "supervised users cannot list districts" tells an attacker how our RBAC works; "failed to join
user_orgs on ltree path" reveals the database schema.

Default to the `ApiErrorMessage` enum for all error messages — it keeps wording consistent and prevents accidental
information disclosure. Extend the enum when you need a new generic message. Plain strings are acceptable when you judge
that a more specific, but still safe,  message improves the developer or user experience, as long as it doesn't reveal
RBAC logic, table names, or query internals. 

Anything useful for debugging — user IDs, role lists, query context — goes into logger calls and the `context` field on
`ApiError`. Neither of these are included in the API response and hence don't pose an information disclosure risk.

### How `ApiError` fields flow

| Field | Exposed to client | Purpose |
|-------|-----------------|---------|
| `message` | Yes (via `formatApiError`) | Human-readable error — use `ApiErrorMessage` enum |
| `code` | Yes | Programmatic error code from `ApiErrorCode` enum |
| `traceId` | Yes | Auto-generated UUID for support reference |
| `context` | No — logged only | Structured debugging data (user IDs, resource IDs, roles) |
| `cause` | No — logged only | Underlying error for internal tracing |

### Incorrect

```typescript
// Leaks authorization implementation details
throw new ApiError('Supervised users cannot list administration districts', {
  statusCode: StatusCodes.FORBIDDEN,
  code: ApiErrorCode.AUTH_FORBIDDEN,
});

// Exposes database schema information
throw new ApiError(`User ${userId} not found in users table`, {
  statusCode: StatusCodes.NOT_FOUND,
  code: ApiErrorCode.RESOURCE_NOT_FOUND,
});

// Reveals internal query logic
throw new ApiError('Failed to join user_orgs with orgs table on ltree path', {
  statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
  code: ApiErrorCode.DATABASE_QUERY_FAILED,
});
```

### Correct

```typescript
// 403 — log details internally, return generic enum message to client
if (!hasSupervisoryRole(userRoles)) {
  logger.warn(
    { userId, administrationId, userRoles },
    'Supervised user attempted to list administration districts',
  );
  throw new ApiError(ApiErrorMessage.FORBIDDEN, {
    statusCode: StatusCodes.FORBIDDEN,
    code: ApiErrorCode.AUTH_FORBIDDEN,
    context: { userId, administrationId, userRoles },
  });
}

// 404 — no table names or user IDs in the message
throw new ApiError(ApiErrorMessage.NOT_FOUND, {
  statusCode: StatusCodes.NOT_FOUND,
  code: ApiErrorCode.RESOURCE_NOT_FOUND,
  context: { userId, resourceId },
});

// 500 — plain string is acceptable here; still generic enough to be safe
logger.error({ err: error, context: { userId, resourceId } }, 'Failed to query administration data');
throw new ApiError('Failed to retrieve administration data', {
  statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
  code: ApiErrorCode.DATABASE_QUERY_FAILED,
  context: { userId, resourceId },
  cause: error,
});
```

### Quick reference

**Error messages** (client-facing, from `ApiErrorMessage` enum): `FORBIDDEN`, `NOT_FOUND`, `UNAUTHORIZED`, `CONFLICT`. See `src/enums/api-error-message.enum.ts` for the full list.

**Error codes** (programmatic, from `ApiErrorCode` enum): See `src/enums/api-error-code.enum.ts` for the full list.

### The principle

Detailed error messages are an information disclosure vulnerability (OWASP Top 10). The `ApiErrorMessage` enum is the first line of defense — it keeps client-facing messages generic and consistent. Extend it when a new category of error comes up rather than writing one-off strings. When a plain string is the better choice, keep it safe: describe what failed, not how. The `context` and `cause` fields on `ApiError` are for internal logging only and never reach the client.
