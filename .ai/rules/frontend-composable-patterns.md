---
title: Frontend Composable Patterns
description: Composables encapsulate reusable logic — query wrappers use computeQueryOverrides, container composables extract domain logic, utility composables stay focused.
impact: MEDIUM
scope: frontend
tags: vue, composables, tanstack-query, reactivity
---

## Frontend composable patterns

Composables are the primary abstraction for reusable logic. All composables are prefixed with `use` and are `.js` files. They fall into three categories:

- **Query and mutation composables** (`composables/queries/`, `composables/mutations/`) — thin wrappers around TanStack Query. They standardize data fetching and cache invalidation. These are global and shared across the app.
- **Logic composables** (`containers/<Name>/composables/`) — extract domain-specific logic (filtering, data transformation, export orchestration) from containers to keep them lean and testable. These are scoped to the container they serve.
- **Utility composables** (`composables/`) — general-purpose reactive helpers (debounce, user type derivation, permissions) reused across multiple containers.

### Incorrect

```javascript
// Composable that does too many things — split into focused composables
export function useAdministrationPage() {
  // fetching + filtering + exporting + form state all in one
}

// Query composable managing its own enabled logic instead of using computeQueryOverrides
export function useDistrictsQuery(districtIds) {
  const isEnabled = computed(() => districtIds.value?.length > 0);
  return useQuery({
    queryKey: [DISTRICTS_QUERY_KEY, districtIds],
    queryFn: () => fetchDistricts(districtIds),
    enabled: isEnabled,
  });
}
```

### Correct

**Query composables** wrap TanStack Query. When a query has enabling conditions (e.g., waiting for an ID or claims to load), use `computeQueryOverrides` for consistent enablement. Queries with no conditions can skip it.

```javascript
const useDistrictsQuery = (districtIds, queryOptions = undefined) => {
  const conditions = [() => hasArrayEntries(districtIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [DISTRICTS_QUERY_KEY, districtIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.DISTRICTS, districtIds),
    enabled: isQueryEnabled,
    ...options,
  });
};
```

`computeQueryOverrides` accepts an array of conditions and optional query options. It merges them into a single computed `isQueryEnabled` and extracts `enabled` from query options to avoid conflicts. All query composables use this pattern.

**Mutation composables** are minimal — call the mutation function and invalidate related queries:

```javascript
const useUpdateUserMutation = () => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: USER_UPDATE_MUTATION_KEY,
    mutationFn: async ({ userId, userData }) => {
      await authStore.roarfirekit.updateUserData(userId, userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_DATA_QUERY_KEY] });
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

  const resetFilters = () => { /* ... */ };

  return { filterSchools, filterGrades, filteredTableData, resetFilters };
}
```

**Utility composables** stay focused on one concern:

```javascript
// composables/useUserType.js — derive role from claims
export default function useUserType(userClaims) {
  const userType = computed(() => { /* role inference logic */ });

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
├── queries/           # Shared query composables (useAdministrationsListQuery, etc.)
├── mutations/         # Shared mutation composables (useUpsertAdministrationMutation, etc.)
├── useDebounce.js     # Shared utility composables
├── usePermissions.js
└── useUserType.js

containers/<Name>/
└── composables/       # Container-specific composables
    ├── useProgressData.js
    └── useProgressFilters.js
```

Shared composables go in `src/composables/`. Logic specific to a single container goes in that container's `composables/` directory.

### The principle

Composables are the building blocks of the container pattern. Query composables standardize data fetching with consistent enablement via `computeQueryOverrides`. Container composables keep containers lean by extracting domain logic into testable, focused units. When a composable grows beyond one concern, split it — a composable that handles filtering, exporting, and form state is doing too much.
