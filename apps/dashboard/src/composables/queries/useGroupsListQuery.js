import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { mapGroupToOrg } from '@/helpers/mapOrg';
import { GROUPS_LIST_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the groups list request.
 *
 * The sole consumer (CreateOrgs) folds the full set into a Tags autocomplete
 * suggestion list, so the query walks the response's pagination and returns the
 * complete array rather than a single server page.
 */
const GROUPS_LIST_PER_PAGE = 100;

/**
 * Groups list query.
 *
 * Fetches the groups accessible to the caller from the backend `GET /groups`
 * endpoint. The API already scopes results to the caller's permissions — super
 * admins receive every group, everyone else receives only the groups they
 * belong to in a supervisory role — so the legacy claims-based client-side
 * filtering (`useUserClaimsQuery` + `useUserType` + `minimalAdminOrgs` +
 * `orgFetcher`) is gone. The backend is now the single source of truth for
 * which groups a user can see.
 *
 * Backend response objects (`GroupDetailSchema`) are mapped to the flat org
 * shape the consumers expect — see `mapGroupToOrg`.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` (for the API
 * call). Callers can pass `queryOptions.enabled` to add conditions;
 * `computeQueryOverrides` AND's them together.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the groups array.
 */
const useGroupsListQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();

  const conditions = [() => Boolean(authStore.accessToken)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [GROUPS_LIST_QUERY_KEY],
    queryFn: async () => {
      const client = getRoarApiClient();
      const groups = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.groups.list({
          query: {
            page,
            perPage: GROUPS_LIST_PER_PAGE,
            sortBy: 'name',
            sortOrder: 'asc',
          },
        });

        if (result.status !== StatusCodes.OK) {
          // Surface non-200 ts-rest results as thrown errors so TanStack routes
          // them through `error`. The thrown shape carries the ts-rest response
          // so downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch groups with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        groups.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return groups.map(mapGroupToOrg);
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth errors and rostering-ended are not transient; retrying only
    // delays the user-facing error. Placed after `...options` so a
    // caller-supplied `retry` can't silently override the policy.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useGroupsListQuery;
