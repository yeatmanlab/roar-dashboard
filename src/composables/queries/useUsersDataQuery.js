import { useQuery } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { USERS_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

const fetchMultipleDocs = async (uids) => {
  console.log('results ', results);
  const results = await Promise.all(uids.map((uid) => fetchDocById(FIRESTORE_COLLECTIONS.USERS, uid)));
  return results;
};

/**
 * User profile data query for multiple users.
 *
 * @param {string|undefined|null} userId[] – The user IDs to fetch, set to a falsy value to fetch the current user.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUsersDataQuery = (userIds = [], queryOptions = undefined) => {
  const queryConditions = [() => userIds.length > 0];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);
  console.log('isqueryenabled', isQueryEnabled);
  console.log('uid', userIds[0]);

  return useQuery({
    queryKey: [USERS_DATA_QUERY_KEY, userIds],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USERS, userIds[0]),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUsersDataQuery;
