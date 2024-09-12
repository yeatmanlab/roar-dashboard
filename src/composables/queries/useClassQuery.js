import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { CLASS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Class Query
 *
 * Query designed to fetch a single class record by its ID.
 *
 * @param {ref<String>} classId – The ID of the school to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useClassQuery = (classId, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => !_isEmpty(classId)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [CLASS_QUERY_KEY, classId],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.CLASSES, classId),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useClassQuery;
