import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocumentsById } from '@/helpers/query/utils';
import { DISTRICTS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Districts query.
 *
 * @param {Array} districtIds – The array of class IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useDistrictsQuery = (districtIds, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => !_isEmpty(districtIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [DISTRICTS_QUERY_KEY, districtIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.DISTRICTS, toValue(districtIds)),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useDistrictsQuery;
