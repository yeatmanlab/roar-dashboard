import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { mapDistrictToOrg } from '@/helpers/mapOrg';
import { DISTRICTS_LIST_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the districts list request.
 *
 * Consumers (OrgPicker, OrgsList, CreateOrgs) render the full set in a select
 * and paginate/sort client-side, so the query walks the response's pagination
 * and returns the complete array rather than a single server page.
 */
const DISTRICTS_LIST_PER_PAGE = 100;

/**
 * Districts list query.
 *
 * Fetches the districts accessible to the caller from the backend
 * `GET /districts` endpoint. The API already scopes results to the caller's
 * permissions — super admins receive every district, everyone else receives
 * only the districts they belong to — so the legacy claims-based client-side
 * filtering (`useUserClaimsQuery` + `useUserType` + `minimalAdminOrgs` +
 * `orgFetcher`) is gone. The backend is now the single source of truth for
 * which districts a user can see.
 *
 * Backend response objects (`DistrictDetailSchema`) are mapped to the flat org
 * shape the consumers expect — see `mapDistrictToOrg`.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` (for the API
 * call). Callers can pass `queryOptions.enabled` to add conditions;
 * `computeQueryOverrides` AND's them together.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the districts array.
 */
const useDistrictsListQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();

  const conditions = [() => Boolean(authStore.accessToken)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [DISTRICTS_LIST_QUERY_KEY],
    queryFn: async () => {
      const client = getRoarApiClient();
      const districts = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.districts.list({
          query: {
            page,
            perPage: DISTRICTS_LIST_PER_PAGE,
            sortBy: 'name',
            sortOrder: 'asc',
          },
        });

        if (result.status !== StatusCodes.OK) {
          // Surface non-200 ts-rest results as thrown errors so TanStack routes
          // them through `error`. The thrown shape carries the ts-rest response
          // so downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch districts with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        districts.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return districts.map(mapDistrictToOrg);
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

export default useDistrictsListQuery;
