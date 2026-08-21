import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { mapSchoolToOrg } from '@/helpers/mapOrg';
import { DISTRICT_SCHOOLS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the district schools list request.
 *
 * Consumers render the full school set (district select, school-name and
 * grade dictionaries, multiselect filters) so the query walks the response's
 * pagination and returns the complete array rather than a single server page.
 */
const DISTRICT_SCHOOLS_PER_PAGE = 100;

/**
 * District Schools query.
 *
 * Fetches the schools of a given district from the backend
 * `GET /districts/:districtId/schools` endpoint, following pagination so the
 * full set is returned. The API already scopes results to the caller — super
 * admins see all schools in the district, supervisory roles see only schools in
 * their accessible org tree — so the legacy claims-based filtering is gone.
 *
 * Backend response objects (`SchoolDetailSchema`) are mapped to the flat org
 * shape the consumers expect — see `mapSchoolToOrg`.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` (for the API
 * call) and on `districtId` being set.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} districtId – The district whose schools to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the schools array.
 */
const useDistrictSchoolsQuery = (districtId, queryOptions = undefined) => {
  const authStore = useAuthStore();

  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(districtId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [DISTRICT_SCHOOLS_QUERY_KEY, districtId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const schools = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.districts.listSchools({
          params: { districtId: toValue(districtId) },
          query: {
            page,
            perPage: DISTRICT_SCHOOLS_PER_PAGE,
            sortBy: 'name',
            sortOrder: 'asc',
          },
        });

        if (result.status !== StatusCodes.OK) {
          const error = new Error(`Failed to fetch district schools with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        schools.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return schools.map(mapSchoolToOrg);
    },
    ...options,
    enabled: isQueryEnabled,
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useDistrictSchoolsQuery;
