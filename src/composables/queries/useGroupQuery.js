import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { GROUP_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Group Query
 *
 * Query designed to fetch a single group record by its ID.
 *
 * @param {ref<String>} groupId – The ID of the group to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useGroupQuery = (groupId, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => !_isEmpty(groupId)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [GROUP_QUERY_KEY, groupId],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.GROUPS, groupId),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useGroupQuery;
