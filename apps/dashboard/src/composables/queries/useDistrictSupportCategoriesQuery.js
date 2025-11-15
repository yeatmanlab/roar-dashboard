import { useQuery } from '@tanstack/vue-query';
import { DISTRICT_SUPPORT_CATEGORIES_QUERY_KEY } from '@/constants/queryKeys';
import { getDistrictSupportCategories } from '@/helpers/query/scores';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { toValue } from 'vue';

/**
 * District Support Categories query.
 *
 * @param {String} districtId – The districtId to fetch support categories for.
 * @param {String} assignmentId – The assignmentId to fetch support categories for.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDistrictSupportCategoriesQuery = (districtId, assignmentId, queryOptions = undefined) => {
  const queryConditions = [() => !!toValue(districtId), () => !!toValue(assignmentId)];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [DISTRICT_SUPPORT_CATEGORIES_QUERY_KEY, districtId, assignmentId],
    queryFn: () => getDistrictSupportCategories(districtId, assignmentId),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useDistrictSupportCategoriesQuery;
