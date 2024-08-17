import { useQuery } from '@tanstack/vue-query';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';

/**
 * User profile data query.
 *
 * @param {String} userId – The user ID.
 * @param {Integer} userQueryKeyIndex – The index of the query key.
 * @param {QueryOptions|undefined} queryParams – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserDataQuery = (userId, userQueryKeyIndex, queryOptions = undefined) => {
  return useQuery({
    queryKey: [USER_DATA_QUERY_KEY, userId, userQueryKeyIndex],
    queryFn: () => fetchDocById('users', userId),
    ...queryOptions,
  });
};

export default useUserDataQuery;
