---
title: Frontend Composable Patterns
description: Composables encapsulate reusable logic — query wrappers gate on the access token via computeQueryOverrides, unwrap the API envelope, throw structured errors, and pin the retry policy; container composables extract domain logic; utility composables stay focused.
impact: MEDIUM
scope: frontend
tags: vue, composables, tanstack-query, ts-rest, reactivity
---

## Frontend composable patterns

Composables are the primary abstraction for reusable logic. All composables are prefixed with `use` and are `.js` files. They fall into three categories:

- **Query and mutation composables** (`composables/queries/`, `composables/mutations/`) — thin wrappers around TanStack Query. They standardize data fetching and cache invalidation. These are global and shared across the app.
- **Logic composables** (`containers/<Name>/composables/`) — extract domain-specific logic (filtering, data transformation, export orchestration) from containers to keep them lean and testable. These are scoped to the container they serve.
- **Utility composables** (`composables/`) — general-purpose reactive helpers (debounce, user type derivation, permissions) reused across multiple containers.

New query and mutation composables call the ts-rest backend client via `getRoarApiClient()` — see [frontend-backend-api-client](frontend-backend-api-client.md) for the client itself. Legacy composables that still wrap Firestore fetchers or `roarfirekit` exist in not-yet-migrated domains; don't write new ones.

### Incorrect

```javascript
// Composable that does too many things — split into focused composables
export function useAdministrationPage() {
  // fetching + filtering + exporting + form state all in one
}

// Query composable managing its own enabled logic instead of using computeQueryOverrides
export function useTaskVariantsByTaskQuery(taskId) {
  const isEnabled = computed(() => Boolean(taskId.value));
  return useQuery({
    queryKey: [TASK_VARIANTS_QUERY_KEY, taskId],
    queryFn: () => fetchVariants(taskId),
    enabled: isEnabled,
  });
}

// Returning the raw ts-rest result — consumers get { status, body } instead of data,
// and non-200 responses resolve successfully instead of flowing through `error`
queryFn: async () => {
  const client = getRoarApiClient();
  return client.tasks.list({ query: { page: 1, perPage: 100 } });
};

// Retry policy spread BEFORE ...options — a caller-supplied `retry` silently overrides it
return useQuery({
  queryKey: [TASKS_QUERY_KEY],
  queryFn,
  retry: (failureCount, error) =>
    !isTerminalAuthError(error) && failureCount < MAX_RETRIES,
  ...options,
  enabled: isQueryEnabled,
});
```

### Correct

**Query composables** wrap TanStack Query around the typed client. The canonical shape (from `useTaskVariantsByTaskQuery.js`, landed in the T11 migration) covers token gating, envelope unwrapping, pagination, structured error throws, and the retry policy:

```javascript
const useTaskVariantsByTaskQuery = (
  taskId,
  status = undefined,
  queryOptions = undefined,
) => {
  const authStore = useAuthStore();
  // Gate internally on the access token so callers don't have to wire it themselves;
  // caller conditions arrive via queryOptions.enabled and are AND'ed in.
  const conditions = [
    () => Boolean(authStore.accessToken),
    () => Boolean(toValue(taskId)),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(
    conditions,
    queryOptions,
  );

  return useQuery({
    queryKey: [TASK_VARIANTS_QUERY_KEY, taskId, status],
    queryFn: async () => {
      const client = getRoarApiClient();
      const variants = [];
      let page = 1;
      let totalPages = 1;

      // Follow the response's pagination so a list that outgrows one page is
      // fetched completely rather than silently truncated.
      do {
        const result = await client.tasks.listTaskVariants({
          params: { taskId: toValue(taskId) },
          query: { page, perPage: VARIANTS_LIST_PER_PAGE },
        });

        if (result.status !== StatusCodes.OK) {
          // Non-200 ts-rest results are surfaced as thrown errors so TanStack
          // routes them through `error`. The thrown shape carries the ts-rest
          // response so downstream error handlers can introspect it.
          const error = new Error(
            `Failed to fetch task variants with status ${result.status}`,
          );
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        // Unwrap the success envelope: { data: { items, pagination } }
        variants.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return variants;
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth errors and rostering-ended are not transient; retrying
    // delays the user-facing error UX. Placed after `...options` so a
    // caller-supplied `retry` can't silently override the policy.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};
```

The load-bearing details:

- **Token gating.** Every backend-client query includes `() => Boolean(authStore.accessToken)` in its conditions. The query never fires before auth is ready, and callers can't accidentally bypass the gate with `enabled: true`.
- **`computeQueryOverrides`** accepts an array of conditions and optional query options. It merges them into a single computed `isQueryEnabled` and extracts `enabled` from the caller's options to avoid conflicts. All query composables use this pattern.
- **Envelope unwrapping.** Composables return domain data (`result.body.data` / aggregated `items`), never the raw ts-rest result.
- **Structured error throws.** Non-success statuses throw an `Error` carrying `.status` and `.body` so error handlers (and the retry policy) can introspect the failure via `utils/api-errors.js` helpers.
- **Retry policy after `...options`.** `MAX_RETRIES = 3`, short-circuited by `isRosteringEndedError` / `isTerminalAuthError`. Spreading the policy after `...options` pins it against caller overrides.
- **Centralized query keys.** Keys come from `constants/queryKeys.js` — never inline string literals.

**Mutation composables** are minimal — call the typed client, interpret the status, invalidate related queries. From `useUpdateTaskVariantMutation.js`:

```javascript
const useUpdateTaskVariantMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [TASK_VARIANT_UPDATE_MUTATION_KEY],
    mutationFn: async ({ taskId, variantId, body }) => {
      const client = getRoarApiClient();
      const result = await client.tasks.updateTaskVariant({
        params: { taskId, variantId },
        body,
      });

      // 204 No Content is a success with no body — resolve to undefined and
      // let callers rely on the invalidation refetch for fresh data.
      if (result.status === StatusCodes.NO_CONTENT) {
        return undefined;
      }

      const error = new Error(
        `Update task variant failed with status ${result.status}`,
      );
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    onSuccess: () => {
      // Prefix invalidation: matches every query whose key starts with
      // TASK_VARIANTS_QUERY_KEY (per-task and cross-task variants alike).
      queryClient.invalidateQueries({ queryKey: [TASK_VARIANTS_QUERY_KEY] });
    },
  });
};
```

**Container-specific composables** extract domain logic from containers. They accept refs as parameters and return refs, computed values, or methods:

```javascript
// containers/ProgressReport/composables/useProgressFilters.js
export function useProgressFilters(progressData) {
  const filterSchools = ref([]);
  const filterGrades = ref([]);
  const filteredTableData = ref(progressData.value);

  watch([filterSchools, filterGrades], ([schools, grades]) => {
    // Apply filters to progressData
  });

  const resetFilters = () => {
    /* ... */
  };

  return { filterSchools, filterGrades, filteredTableData, resetFilters };
}
```

**Utility composables** stay focused on one concern:

```javascript
// composables/useUserType.js — derive role from claims
export default function useUserType(userClaims) {
  const userType = computed(() => {
    /* role inference logic */
  });

  return {
    userType,
    isAdmin: computed(() => userType.value === AUTH_USER_TYPE.ADMIN),
    isSuperAdmin: computed(() => userType.value === AUTH_USER_TYPE.SUPER_ADMIN),
  };
}
```

### Directory structure

```
composables/
├── queries/           # Shared query composables (useTasksQuery, useTaskVariantsByTaskQuery, etc.)
├── mutations/         # Shared mutation composables (useUpdateTaskVariantMutation, etc.)
├── useDebounce.js     # Shared utility composables
├── usePermissions.js
└── useUserType.js

containers/<Name>/
└── composables/       # Container-specific composables
    ├── useProgressData.js
    └── useProgressFilters.js
```

Shared composables go in `src/composables/`. Logic specific to a single container goes in that container's `composables/` directory.

### Testing

Query composable tests mock `@/clients/roar-api` and `@/store/auth`, then capture the `useQuery` options with `vi.spyOn(VueQuery, 'useQuery')` to assert on the query key, extract `queryFn` for request/pagination/error assertions, read `enabled.value` for gating, and call the captured `retry` callback directly to cover the terminal-error short-circuit. `useTaskVariantsByTaskQuery.test.js` is the reference.

### The principle

Composables are the building blocks of the container pattern. Query composables standardize data fetching — token-gated enablement via `computeQueryOverrides`, envelope unwrapping, structured errors, and a pinned retry policy — so consumers see plain domain data and consistent failure behavior regardless of endpoint. Container composables keep containers lean by extracting domain logic into testable, focused units. When a composable grows beyond one concern, split it — a composable that handles filtering, exporting, and form state is doing too much.
