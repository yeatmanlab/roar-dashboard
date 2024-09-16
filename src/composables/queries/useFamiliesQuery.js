import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
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
const useFamiliesQuery = (familyIds, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => !_isEmpty(familyIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [FAMILIES_QUERY_KEY, familyIds],
    queryFn: () => fetchDocumentsById(FIRESTORE_COLLECTIONS.FAMILIES, toValue(familyIds)),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useFamiliesQuery;
