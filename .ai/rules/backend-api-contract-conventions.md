---
title: Backend API Contract Conventions
description: How to define API contracts — compose shared schemas, use envelopes, always declare 500, set strictStatusCodes.
impact: HIGH
scope: backend
tags: api, contracts, zod, ts-rest
---

## Backend API contract conventions

API contracts in `packages/api-contract/src/v1/<resource>/` are the single source of truth for request/response types. They use ts-rest with Zod schemas, and the frontend, backend, and assessment SDK all derive their types from them.

### File structure

Each resource gets a directory with three files:

| File | Contains |
|------|----------|
| `schema.ts` | Zod schemas for request params, query, and response body |
| `contract.ts` | ts-rest contract definitions (method, path, responses) |
| `index.ts` | Re-exports both modules |

Types are inferred from Zod schemas using `z.infer<typeof Schema>` — don't write separate TypeScript interfaces.

### Compose shared query schemas

List endpoints should compose from the shared schemas in `v1/common/query.ts` rather than redefining pagination, sorting, or embedding:

```typescript
import { PaginationQuerySchema, createSortQuerySchema, createEmbedQuerySchema } from '../common/query';

export const MY_SORT_FIELDS = ['createdAt', 'name'] as const;
export const MY_EMBED_OPTIONS = ['stats', 'details'] as const;

export const MyResourceListQuerySchema = PaginationQuerySchema
  .merge(createSortQuerySchema(MY_SORT_FIELDS, 'createdAt'))
  .merge(createEmbedQuerySchema(MY_EMBED_OPTIONS))
  .extend({
    status: MyStatusSchema.optional(), // resource-specific filters go here
  });
```

### Response envelopes

All responses use the envelope schemas from `v1/response.ts`:

```typescript
import { SuccessEnvelopeSchema, ErrorEnvelopeSchema, createPaginatedResponseSchema } from '../response';

// Single item
responses: {
  200: SuccessEnvelopeSchema(MyResourceSchema),  // → { data: { ... } }
}

// Paginated list
const MyListResponseSchema = createPaginatedResponseSchema(MyResourceSchema);
responses: {
  200: SuccessEnvelopeSchema(MyListResponseSchema),  // → { data: { items: [...], pagination: { ... } } }
}

// Errors
responses: {
  401: ErrorEnvelopeSchema,  // → { error: { message, code?, traceId? } }
  403: ErrorEnvelopeSchema,
  404: ErrorEnvelopeSchema,
  500: ErrorEnvelopeSchema,
}
```

### Contract definition

```typescript
export const MyResourceContract = c.router({
  list: {
    method: 'GET',
    path: '/',
    query: MyResourceListQuerySchema,
    responses: {
      200: SuccessEnvelopeSchema(MyListResponseSchema),
      401: ErrorEnvelopeSchema,
      500: ErrorEnvelopeSchema,
    },
    strictStatusCodes: true,
  },
  get: {
    method: 'GET',
    path: '/:id',
    pathParams: z.object({ id: z.string().uuid() }),  // or a semantic name like groupId, taskId
    responses: {
      200: SuccessEnvelopeSchema(MyResourceSchema),
      401: ErrorEnvelopeSchema,
      403: ErrorEnvelopeSchema,
      404: ErrorEnvelopeSchema,
      500: ErrorEnvelopeSchema,
    },
    strictStatusCodes: true,
  },
}, { pathPrefix: '/my-resource' });
```

Two things that should always be present:
- **`500: ErrorEnvelopeSchema`** — enables controllers to return typed 500 responses via `toErrorResponse()` instead of relying on the global error handler.
- **`strictStatusCodes: true`** — enforces that controllers only return status codes declared in the contract

### Embedding related data

Use the `?embed=` query parameter to optionally include related data on list endpoints. This avoids over-fetching — the base response is fast, and related data is included only when the client needs it.

```
GET /administrations                         # Base data only
GET /administrations?embed=stats             # Include stats
GET /administrations?embed=stats,tasks       # Include both
```

In the contract, define the allowed embed options and compose with `createEmbedQuerySchema`:

```typescript
export const MY_EMBED_OPTIONS = ['stats', 'tasks'] as const;

// Type-safe constants for use in service layer
export const MyEmbedOption = {
  STATS: 'stats',
  TASKS: 'tasks',
} as const satisfies Record<string, MyEmbedOptionType>;
```

The `createEmbedQuerySchema` handles parsing — it splits the comma-separated string and filters to allowed values, so the service receives a typed `string[]`. In the service layer, resolve embeds after the main query and attach to results:

```typescript
const embedOptions = options.embed ?? [];
if (embedOptions.length === 0) return result;

const shouldEmbedStats = embedOptions.includes(MyEmbedOption.STATS);
const shouldEmbedTasks = embedOptions.includes(MyEmbedOption.TASKS);

const statsMap = shouldEmbedStats ? await fetchStats(ids) : null;
const tasksMap = shouldEmbedTasks ? await fetchTasks(ids) : null;

// Attach to each item
```

### Registration

Add the contract to the router and re-export in `v1/index.ts`:

```typescript
export const ApiContractV1 = c.router({
  // ...existing contracts
  myResource: MyResourceContract,
});

export * from './my-resource/index';
```

### Incorrect

```typescript
// Redefining pagination instead of composing shared schemas
export const MyQuery = z.object({
  page: z.number().default(1),
  limit: z.number().default(25),
  sort: z.string().optional(),
});

// Missing 500 in responses — controller can't return typed error
responses: {
  200: SuccessEnvelopeSchema(MySchema),
  401: ErrorEnvelopeSchema,
},

// Missing strictStatusCodes — no compile-time safety on response types
get: {
  method: 'GET',
  path: '/:id',
  responses: { /* ... */ },
  // strictStatusCodes not set
},
```

### The principle

The contract is the type boundary between frontend and backend. When it uses shared schemas, both sides get consistent pagination, sorting, and error shapes without coordination. `strictStatusCodes` turns mismatches between declared and returned status codes into compile errors rather than runtime surprises. The 500 declaration ensures even unexpected errors flow through the typed response path.
