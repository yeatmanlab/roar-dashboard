---
title: Frontend State Management
description: Pinia owns client state (auth, UI). TanStack Query owns server state (API data, caching, invalidation). Data fetching lives in containers, not presentational components.
impact: HIGH
scope: frontend
tags: pinia, tanstack-query, composables, state, data-fetching
---

## Frontend state management
The dashboard's frontend relies on two main state management solutions: Pinia and TanStack Query. Each has a clear ownership domain to keep state organized and maintainable.

While Pinia stores hold client-owned state — authentication, UI preferences, session data, TanStack Query owns all server state — API data fetching, caching, and invalidation. 

Don't cache API responses in Pinia. Data fetching happens in containers via query composables; presentational components receive data through props.

### Incorrect

```javascript
// Caching server data in Pinia — TanStack Query should own this
const useScoreStore = defineStore('score', {
  state: () => ({ appScores: [], identifiers: [] }),
  actions: {
    async fetchScores(administrationId) {
      this.appScores = await getScores(administrationId);
    },
  },
});

// Fetching data without TanStack Query — no caching, no invalidation
const scores = ref([]);
onMounted(async () => {
  scores.value = await fetchScoresFromApi();
});

// Presentational component fetching its own data — belongs in the container
const { data } = useAdministrationsQuery();
```

### Correct

**Pinia** — client state only:

```javascript
// auth.js — identity, Firebase client, session flags
export const useAuthStore = defineStore('auth', {
  state: () => ({
    firebaseUser: { admin: null, app: null },
    userClaims: null,
    roarfirekit: null,
    ssoProvider: null,
    showOptionalAssessments: false,
  }),
});

// game.js — minimal UI state
export const useGameStore = defineStore('game', {
  state: () => ({
    selectedAdmin: undefined,
    requireRefresh: false,
  }),
});
```

**TanStack Query** — server state, used in containers:

```javascript
// composables/queries/useAdministrationsListQuery.js
const useAdministrationsListQuery = (orderBy, queryOptions) => {
  const authStore = useAuthStore();
  const { userClaims } = storeToRefs(authStore);

  const { isQueryEnabled, options } = computeQueryOverrides(
    { adminOrgs: userClaims },
    queryOptions,
  );

  return useQuery({
    queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY, orderBy],
    queryFn: () => administrationPageFetcher(/* ... */),
    enabled: isQueryEnabled,
    ...options,
  });
};
```

**Mutations** invalidate queries on success:

```javascript
// composables/mutations/useUpsertAdministrationMutation.js
const useUpsertAdministrationMutation = () => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ADMINISTRATION_UPSERT_MUTATION_KEY,
    mutationFn: async (data) => {
      await authStore.roarfirekit.createAdministration(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_QUERY_KEY] });
    },
  });
};
```

### Where data fetching lives

Data fetching follows the container pattern:

| Layer | Fetches data? | Accesses stores? |
|-------|--------------|-----------------|
| Page | No | No — just passes route params to container |
| Container | Yes — via query composables | Yes — auth store for identity and query enablement |
| Presentational | No — receives data via props | No — emits events for interactions |

### Query and mutation keys

Keys are centralized in constants files — never use string literals inline:

- `src/constants/queryKeys.js` — all query keys
- `src/constants/mutationKeys.js` — all mutation keys

Query keys are composite arrays that include context parameters for proper cache separation:

```javascript
queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY, orderBy]
queryKey: [ADMINISTRATION_ASSIGNMENTS_QUERY_KEY, administrationId, `${orgType}-${orgId}`]
```

### TanStack Query defaults

Configured in `src/plugins.js`:

- **`staleTime`**: 10 minutes — queries won't refetch in the background until stale
- **`gcTime`**: 15 minutes — inactive cache entries are garbage collected
- Both disabled (set to `0`) in Cypress E2E tests

### Data fetching layer

Legacy query composables delegate to fetcher functions in `src/helpers/query/` which call the Firestore REST API via Axios. This is being replaced by a typed API client built on the `@roar/api-contract` ts-rest package, which talks to the new backend API. New query composables should use the ts-rest client rather than direct Firestore calls.

### The principle

Pinia and TanStack Query solve different problems. Pinia is for state the client creates and owns (who is logged in,
which sidebar is open). TanStack Query is for state the server owns (administration lists, user data, scores) — it
handles caching, background refetching, and invalidation automatically. Data fetching belongs in containers, not
scattered across presentational components, so the data flow stays unidirectional and testable.
