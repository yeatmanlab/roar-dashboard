import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { mapEnrolledUser } from '@/helpers/mappers/mapEnrolledUser';
import { ORG_USERS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Dispatch table mapping the (plural) org type used throughout the dashboard to
 * the typed ts-rest `listUsers` action and its path-param name.
 *
 * The plural keys (`districts`, `schools`, `classes`, `groups`) are exactly the
 * values the `ListUsers` route receives as `:orgType` — they originate from
 * `activeOrgType` in `OrgsList.vue`, which is a plural `ORG_TYPES` value. Each
 * org type has its own endpoint (`GET /v1/{type}/:id/users`) with a distinct
 * path-param name, so the resolver returns the correct action plus the param
 * key to populate.
 *
 * Correctness/security note: dispatching to the wrong entry would query a
 * different org type (e.g. asking the schools endpoint for a district id), so
 * this map is the single point that pins org type → endpoint. `families` is
 * intentionally absent — there is no per-family user-list endpoint and the
 * `ListUsers` route is never reached for families.
 *
 * @param {ReturnType<typeof getRoarApiClient>} client – The typed ts-rest client.
 * @returns {Record<string, { action: Function, paramKey: string }>} Resolver map.
 */
const orgUsersResolvers = (client) => ({
  districts: { action: client.districts.listUsers, paramKey: 'districtId' },
  schools: { action: client.schools.listUsers, paramKey: 'schoolId' },
  classes: { action: client.classes.listUsers, paramKey: 'classId' },
  groups: { action: client.groups.listUsers, paramKey: 'groupId' },
});

/**
 * Organisation users query (server-driven pagination and sort).
 *
 * Fetches a single page of users enrolled in an org from the per-org backend
 * endpoint `GET /v1/{districts|schools|classes|groups}/:id/users`. The endpoint
 * scopes the result to the caller's accessible org tree via FGA — a
 * non-super-admin only ever sees users within orgs they can access — and
 * paginates + sorts server-side, so the consumer no longer fetches every user
 * in one giant page. Rows are mapped into the legacy nested table shape via
 * {@link mapEnrolledUser}.
 *
 * The frontend passes only `orgId` (the org being viewed) plus paging/sort
 * params; it does not (and cannot) widen the org scope client-side, so the
 * server's FGA check is the sole authority over which users are returned.
 *
 * **Reactivity.** `page`, `perPage`, `sortBy`, and `sortOrder` are accepted as
 * refs/getters and included in the query key by reference, so the query
 * re-keys and refetches when any of them change. `orgType` and `orgId` are part
 * of the key too so each org's list is cached separately.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` plus a truthy
 * `orgType` and `orgId`. Callers can add conditions via `queryOptions.enabled`.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} orgType – Plural org type (districts|schools|classes|groups).
 * @param {import('vue').MaybeRefOrGetter<string>} orgId – The org's UUID.
 * @param {import('vue').MaybeRefOrGetter<number>} page – Current 1-indexed page.
 * @param {import('vue').MaybeRefOrGetter<number>} perPage – Page size (max 100, enforced by the API).
 * @param {import('vue').MaybeRefOrGetter<string>} sortBy – Sort field (nameLast|username|grade).
 * @param {import('vue').MaybeRefOrGetter<string>} sortOrder – Sort direction (asc|desc).
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} TanStack query result resolving to `{ items, pagination }`.
 */
const useOrgUsersQuery = (orgType, orgId, page, perPage, sortBy, sortOrder, queryOptions = undefined) => {
  const authStore = useAuthStore();

  const conditions = [
    () => Boolean(authStore.accessToken),
    () => Boolean(toValue(orgType)),
    () => Boolean(toValue(orgId)),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ORG_USERS_QUERY_KEY, orgType, orgId, page, perPage, sortBy, sortOrder],
    queryFn: async () => {
      const client = getRoarApiClient();
      const resolvedOrgType = toValue(orgType);
      const resolver = orgUsersResolvers(client)[resolvedOrgType];

      if (!resolver) {
        // A guard, not a user-facing path: enablement requires a truthy orgType,
        // and the only callers pass a plural ORG_TYPES value. An unknown type here
        // means a programming error (e.g. a new org type wired without an endpoint).
        throw new Error(`useOrgUsersQuery: unsupported org type "${resolvedOrgType}"`);
      }

      const result = await resolver.action({
        params: { [resolver.paramKey]: toValue(orgId) },
        query: {
          page: toValue(page),
          perPage: toValue(perPage),
          sortBy: toValue(sortBy),
          sortOrder: toValue(sortOrder),
        },
      });

      if (result.status !== StatusCodes.OK) {
        // Surface non-200 ts-rest results as thrown errors so TanStack routes them
        // through `error`. The thrown shape carries the ts-rest response so downstream
        // error handlers can introspect it.
        const error = new Error(`Failed to fetch org users with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      // Return the page payload so the consumer gets both the current page's rows
      // (mapped to the legacy table shape) and the pagination envelope.
      return {
        items: result.body.data.items.map(mapEnrolledUser),
        pagination: result.body.data.pagination,
      };
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth errors and rostering-ended are not transient; retrying only delays
    // the user-facing error. Placed after `...options` so a caller-supplied `retry` can't
    // silently override the policy.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useOrgUsersQuery;
