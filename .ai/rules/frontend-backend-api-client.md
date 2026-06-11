---
title: Frontend Backend API Client
description: All dashboard calls to the ROAR backend go through the lazily-initialized ts-rest client returned by getRoarApiClient() — typed contract paths, automatic auth headers with a single 401 token-refresh retry, enveloped responses, and structured error surfacing.
impact: HIGH
scope: frontend
tags: ts-rest, api-client, auth, vite, cypress
---

## Frontend backend API client

The dashboard talks to the ROAR backend exclusively through the typed ts-rest client in `src/clients/roar-api/`. `getRoarApiClient()` returns a singleton initialized from `@roar-platform/api-contract`, so request paths, query parameters, and response shapes are all derived from the contract — never hand-rolled.

### How the client works

- **Lazy initialization.** The client is created on the first `getRoarApiClient()` call, not at module load. It throws if `VITE_ROAR_API_BASE_URL` is unset — add the variable to `.env.development` / `.env.production` (and the CI/preview environment) before wiring a new deployment.
- **Auth headers.** Every request reads `authStore.accessToken` synchronously and sends it as a `Bearer` token. Composables must still gate on the token's existence (see [frontend-composable-patterns](frontend-composable-patterns.md)) — the client doesn't wait for auth.
- **Built-in 401 retry.** On a 401 with error code `auth/token-expired`, the client forces a token refresh via `authStore.forceIdTokenRefresh()` and retries the request once. A 401 that reaches your composable means that retry already failed — treat it as terminal (`isTerminalAuthError`), don't retry again.
- **Typed resources.** Endpoints are addressed via contract router names: `client.tasks.list(...)`, `client.tasks.listTaskVariants(...)`, `client.taskVariants.list(...)`, `client.taskBundles.list(...)`, `client.me.get(...)`, etc. Check `packages/api-contract/src/v1/index.ts` for the resource map.

### Incorrect

```javascript
// Hand-rolled fetch — loses contract typing, auth header injection, and the 401 retry
const res = await fetch(
  `${import.meta.env.VITE_ROAR_API_BASE_URL}/v1/tasks?page=1`,
  {
    headers: { Authorization: `Bearer ${authStore.accessToken}` },
  },
);
const tasks = await res.json();

// Creating a new client per call — bypasses the singleton and its lazy init guard
const client = initClient(ApiContractV1, {
  baseUrl: import.meta.env.VITE_ROAR_API_BASE_URL,
});

// Treating the ts-rest result as data — result is { status, body }, and the
// payload sits inside the success envelope at body.data
const tasks = await client.tasks.list({ query: { page: 1, perPage: 100 } });
return tasks.items; // undefined!

// Swallowing non-200s — TanStack Query resolves the query as a success
const result = await client.tasks.list({ query });
return result.status === 200 ? result.body.data.items : [];
```

### Correct

```javascript
import { StatusCodes } from "http-status-codes";
import { getRoarApiClient } from "@/clients/roar-api";

const client = getRoarApiClient();
const result = await client.tasks.list({ query: { page: 1, perPage: 100 } });

if (result.status !== StatusCodes.OK) {
  // Throw a structured error so TanStack Query routes it through `error`
  // and utils/api-errors.js helpers can introspect the response.
  const error = new Error(`Failed to fetch tasks with status ${result.status}`);
  error.status = result.status;
  error.body = result.body;
  throw error;
}

// Success envelope: { data: ... } — paginated lists are { data: { items, pagination } }
const tasks = result.body.data.items;
```

### Response and error shapes

| Outcome         | ts-rest result                                                       | What to do                                           |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| Single resource | `{ status: 200, body: { data: {...} } }`                             | Return `result.body.data`                            |
| Paginated list  | `{ status: 200, body: { data: { items, pagination } } }`             | Aggregate `items` following `pagination.totalPages`  |
| Created         | `{ status: 201, body: { data: { id } } }`                            | Return `result.body.data`                            |
| No content      | `{ status: 204, body: undefined }`                                   | Resolve `undefined`; rely on query invalidation      |
| Error           | `{ status: 4xx/5xx, body: { error: { message, code?, traceId? } } }` | Throw an `Error` with `.status` and `.body` attached |

Query parameters use the contract's **wire format** — e.g. `embed` is a comma-separated string (`embed: 'parameters'`, `embed: 'stats,tasks'`), not an array; the contract's Zod transform does the splitting server-side.

The error helpers in `src/utils/api-errors.js` (`getApiErrorCode`, `isTerminalAuthError`, `isRosteringEndedError`) understand the thrown shape — use them in retry policies and error handlers instead of re-parsing `body.error` inline.

### When NOT to use the client

- **Not-yet-migrated domains.** Domains still on `roarfirekit` / Firestore REST helpers (e.g. parts of administrations, orgs, users) keep their legacy data path until their migration PR lands. Don't mix the two transports for one resource — migrate the domain's reads and writes together.
- **Firebase Auth itself.** Sign-in, token refresh, and session management go through the auth store and Firebase SDK; the client only consumes the resulting access token.
- **Static assets and third-party APIs.** The client is bound to the ROAR backend contract; anything else uses its own fetcher.

### Cypress and the build

`vite.config.js` skips Rollup's `manualChunks` when `process.env.CYPRESS` is set: the Cypress spec preprocessor (cypress-vite) compiles each spec with `inlineDynamicImports`, which Rollup rejects in combination with `manualChunks`. The guard scopes chunking to real application builds only — don't remove it, and don't add chunking config outside that guard. For e2e specs, prefer backend-only `cy.request` calls against the contract paths over intercepting the client (see [frontend-e2e-testing-pattern](frontend-e2e-testing-pattern.md)).

### The principle

One client, one contract. Because every dashboard request flows through the contract-typed singleton, request/response drift between frontend and backend surfaces as a type error or a failing contract test — not a production bug. The client owns transport concerns (base URL, auth header, 401 refresh retry); composables own data concerns (enablement, unwrapping, pagination, error semantics). Keeping that boundary crisp is what makes both layers independently testable.
