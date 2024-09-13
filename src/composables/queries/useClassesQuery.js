import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocumentsById } from '@/helpers/query/utils';
import { CLASSES_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Classes Query
 *
 * Query designed to fetch class records by ID.
 *
 * @param {Array} classId – The array of class IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useClassesQuery = (classIds, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => !_isEmpty(classIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [CLASSES_QUERY_KEY, classIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.CLASSES, toValue(classIds)),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useClassesQuery;
