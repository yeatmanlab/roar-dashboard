import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { FAMILY_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Family Query
 *
 * Query designed to fetch a single family record by its ID.
 *
 * @param {String} familyId – The ID of the family to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useFamilyQuery = (familyId, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => !_isEmpty(familyId)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [FAMILY_QUERY_KEY, familyId],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.FAMILIES, familyId),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useFamilyQuery;
