import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { DISTRICT_SUPPORT_CATEGORIES_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * District Support Categories query.
 *
 * Fetches aggregated support category counts and distributions across schools and grades
 * for all scored tasks in a district administration from the ts-rest backend API.
 *
 * @param {String} districtId - The district UUID
 * @param {String} administrationId - The administration UUID
 * @param {QueryOptions|undefined} queryOptions - Optional TanStack query options
 * @returns {UseQueryResult} The TanStack query result
 */
const useDistrictSupportCategoriesQuery = (districtId, administrationId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [
    () => Boolean(authStore.accessToken),
    () => Boolean(toValue(districtId)) && Boolean(toValue(administrationId)),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [DISTRICT_SUPPORT_CATEGORIES_QUERY_KEY, districtId, administrationId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.administrations.aggregateSupportCategories({
        params: { id: toValue(administrationId) },
        query: { districtId: toValue(districtId) },
      });

      if (result.status !== StatusCodes.OK) {
        const error = new Error(`Failed to fetch support categories with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      return result.body.data;
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

export default useDistrictSupportCategoriesQuery;
