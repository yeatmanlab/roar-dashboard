import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { SCHOOL_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * School Query
 *
 * Query designed to fetch a single school record by its ID.
 *
 * @param {String} schoolId – The ID of the school to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useSchoolQuery = (schoolId, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query.
  const conditions = [() => !_isEmpty(schoolId)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [SCHOOL_QUERY_KEY, schoolId],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.SCHOOLS, schoolId),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useSchoolQuery;
