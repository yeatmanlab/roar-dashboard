import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocumentsById } from '@/helpers/query/utils';
import { SCHOOLS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * School Query
 *
 * @param {Array} schoolIds – The array of school IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useSchoolsQuery = (schoolIds, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => !_isEmpty(schoolIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [SCHOOLS_QUERY_KEY, schoolIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.SCHOOLS, toValue(schoolIds)),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useSchoolsQuery;