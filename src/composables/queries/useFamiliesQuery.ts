import { type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryReturnType, type UseQueryOptions } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { hasArrayEntries } from '@/helpers/hasArrayEntries';
import { fetchDocumentsById } from '@/helpers/query/utils';
import { FAMILIES_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Families Query
 *
 * @param {Array} familyIds – The array of family IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useFamiliesQuery = (familyIds, queryOptions?: UseQueryOptions): UseQueryReturnType => {
  // Ensure all necessary data is available before enabling the query.
  const conditions = [() => hasArrayEntries(familyIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [FAMILIES_QUERY_KEY, familyIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.FAMILIES, familyIds),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useFamiliesQuery;
