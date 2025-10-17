import { useQuery } from '@tanstack/vue-query';
import { DISTRICT_SUPPORT_CATEGORIES_QUERY_KEY } from '@/constants/queryKeys';
import { getDistrictSupportCategories } from '@/helpers/query/scores';

/**
 * District Support Categories query.
 *
 * @param {String} districtId – The districtId to fetch support categories for.
 * @param {String} assignmentId – The assignmentId to fetch support categories for.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDistrictSupportCategoriesQuery = (districtId, assignmentId) => {
  return useQuery({
    queryKey: [DISTRICT_SUPPORT_CATEGORIES_QUERY_KEY, districtId, assignmentId],
    queryFn: () => getDistrictSupportCategories(districtId, assignmentId),
  });
};

export default useDistrictSupportCategoriesQuery;
