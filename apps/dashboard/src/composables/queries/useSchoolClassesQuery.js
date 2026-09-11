import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { mapClassToOrg } from '@/helpers/mapOrg';
import { SCHOOL_CLASSES_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the school classes list request.
 *
 * The sole consumer (CreateOrgs) folds the full class set into a Tags
 * autocomplete suggestion list, so the query walks the response's pagination
 * and returns the complete array rather than a single server page.
 */
const SCHOOL_CLASSES_PER_PAGE = 100;

/**
 * School Classes query.
 *
 * Fetches the classes of a given school from the backend
 * `GET /schools/:schoolId/classes` endpoint, following pagination so the full
 * set is returned. The API already scopes results to the caller and returns
 * only active classes, so the legacy claims-based filtering is gone.
 *
 * Backend response objects (`SchoolClassSchema`) are mapped to the flat org
 * shape the consumers expect — see `mapClassToOrg`.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` (for the API
 * call) and on `schoolId` being set.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} schoolId – The school whose classes to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the classes array.
 */
const useSchoolClassesQuery = (schoolId, queryOptions = undefined) => {
  const authStore = useAuthStore();

  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(schoolId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [SCHOOL_CLASSES_QUERY_KEY, schoolId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const classes = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.schools.listClasses({
          params: { schoolId: toValue(schoolId) },
          query: {
            page,
            perPage: SCHOOL_CLASSES_PER_PAGE,
            sortBy: 'name',
            sortOrder: 'asc',
          },
        });

        if (result.status !== StatusCodes.OK) {
          const error = new Error(`Failed to fetch school classes with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        classes.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return classes.map(mapClassToOrg);
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

export default useSchoolClassesQuery;
