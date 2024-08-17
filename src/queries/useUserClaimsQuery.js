import { useQuery } from '@tanstack/vue-query';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_CLAIMS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * User claims data query.
 *
 * @param {String} userId – The user ID.
 * @param {Integer} userQueryKeyIndex – The index of the query key.
 * @param {QueryOptions|undefined} queryParams – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserClaimsQuery = (userId, userQueryKeyIndex, queryParams = undefined) => {
  return useQuery({
    queryKey: [USER_CLAIMS_QUERY_KEY, userId, userQueryKeyIndex],
    queryFn: () => fetchDocById('users', userId),
    ...queryParams,
  });
};

export default useUserClaimsQuery;
