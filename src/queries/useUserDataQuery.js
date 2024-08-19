import { useQuery } from '@tanstack/vue-query';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

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
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USERS, userId),
    ...queryOptions,
  });
};

export default useUserDataQuery;
