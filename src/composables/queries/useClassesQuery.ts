import { type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryReturnType, type UseQueryOptions } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocumentsById } from '@/helpers/query/utils';
import { hasArrayEntries } from '@/helpers/hasArrayEntries';
import { CLASSES_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Classes query.
 *
 * @param {Array} classId – The array of class IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useClassesQuery = (classIds, queryOptions?: UseQueryOptions): UseQueryReturnType => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => hasArrayEntries(classIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [CLASSES_QUERY_KEY, classIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.CLASSES, classIds),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useClassesQuery;
