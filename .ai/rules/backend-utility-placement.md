---
title: Backend utility placement
description: Utility files belong to the lowest layer that consumes them. Don't create cross-layer grab bags.
impact: MEDIUM
scope: backend
tags: architecture, utilities, separation-of-concerns
---

## Backend utility placement

Utility functions follow the same layer boundaries as the rest of the backend. A utility belongs to the lowest layer that consumes it. When a single file contains helpers for multiple layers, it becomes a shortcut around the architecture — developers can accidentally import repository-level SQL helpers into a controller, or controller-level transform functions into a repository.

### Where utilities live

| Consumed by | Location | Examples |
|-------------|----------|----------|
| Single repository | `repositories/utils/` | Query-building helpers, Drizzle filter/sort builders |
| Single controller | Inline in the controller file | Simple transform functions (see `backend-controller-no-business-logic`) |
| Multiple controllers | `controllers/utils/` | Shared response transform helpers |
| Single service | Inline in the service closure | Private helpers like `verifyResourceAccess` |
| Multiple services | `utils/` (top-level) | Only if genuinely layer-neutral (e.g., date formatting, string normalization) |
| Multiple layers (types only) | `types/` | Shared interfaces and type aliases |
| Multiple layers (constants only) | `constants/` | Enums, role classifications, permission mappings |

### Incorrect

```typescript
// One file serving two layers — SQL fragments and response transforms side by side
// utils/handle-enrolled-users.ts
export const ENROLLED_USERS_SORT_COLUMNS = { /* Drizzle column refs */ };       // repository concern
export function getEnrolledUsersFilterConditions(options) { /* SQL where */ }    // repository concern
export function transformEnrolledUser(entity) { /* DB → API shape */ }           // controller concern
export interface ListEnrolledUsersOptions { /* ... */ }                          // shared type
```

### Correct

```typescript
// Repository-layer query helpers
// repositories/utils/enrolled-users.query.ts
export const ENROLLED_USERS_SORT_COLUMNS = { /* Drizzle column refs */ };
export function getEnrolledUsersFilterConditions(options) { /* SQL where */ }

// Controller-layer transform helpers
// controllers/utils/enrolled-users.transform.ts
export function transformEnrolledUser(entity) { /* DB → API shape */ }

// Shared types used across layers
// types/enrolled-users.ts
export interface ListEnrolledUsersOptions { /* ... */ }
```

### When to split vs. keep together

Split when a file contains functions consumed by different layers — the layer boundary is the deciding line. Keep together when all functions in the file serve the same layer, even if they're used by multiple files within that layer (e.g., several repositories sharing the same query-building helpers is fine).

A small helper used in one place doesn't need this treatment. The test is: if someone unfamiliar with the code opened the file, would they know which layer they're in? If not, split it.

### The principle

The 5-layer architecture only works if the boundaries are visible. A utility file that spans layers hides those boundaries behind a convenient import path. Placing utilities next to the layer they serve makes the wrong import look obviously wrong — reaching from a repository into `controllers/utils/` is a code smell you can spot in review.
