import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocumentsById } from '@/helpers/query/utils';
import { GROUPS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Group Query
 *
 * @param {Array} groupIds – The array of group IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useGroupsQuery = (groupIds, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => !_isEmpty(groupIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [GROUPS_QUERY_KEY, groupIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.GROUPS, toValue(groupIds)),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useGroupsQuery;
