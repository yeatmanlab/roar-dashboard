import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_SUPPORT_CATEGORIES_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Administration support categories query.
 *
 * Fetches aggregated support category counts and distributions across schools and grades
 * for all scored tasks in a district administration from
 * `GET /administrations/:id/support-categories?districtId=:districtId`.
 *
 * Returns a map of taskId → TaskCounts containing:
 * - Support levels: achievedSkill, developingSkill, needsExtraSupport
 * - Score ranges: raw and percentile breakdowns
 * - Hierarchical counts: by school, grade, and total
 *
 * Supports scored tasks: swr, pa, sre, cva, morphology, trog, roar-inference, swr-es, sre-es.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} administrationId - The administration UUID.
 * @param {import('vue').MaybeRefOrGetter<string>} districtId - The district UUID.
 * @param {QueryOptions|undefined} queryOptions - Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to aggregated support categories.
 */
const useAdministrationSupportCategoriesQuery = (administrationId, districtId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [
    () => Boolean(authStore.accessToken),
    () => Boolean(toValue(administrationId)) && Boolean(toValue(districtId)),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATION_SUPPORT_CATEGORIES_QUERY_KEY, administrationId, districtId],
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

export default useAdministrationSupportCategoriesQuery;
