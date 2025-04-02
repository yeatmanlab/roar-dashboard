import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides.ts';
import { hasArrayEntries } from '@/helpers/hasArrayEntries.ts';
import { fetchDocumentsById } from '@/helpers/query/utils';
import { GROUPS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

interface QueryOptions {
  enabled?: boolean;
  [key: string]: any;
}

/**
 * Group Query
 *
 * @param {string[]} groupIds – The array of group IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryReturnType} The TanStack query result.
 */
const useGroupsQuery = (
  groupIds: string[], 
  queryOptions?: QueryOptions
): UseQueryReturnType<any[], Error> => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => hasArrayEntries(groupIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [GROUPS_QUERY_KEY, groupIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.GROUPS, groupIds),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useGroupsQuery;
