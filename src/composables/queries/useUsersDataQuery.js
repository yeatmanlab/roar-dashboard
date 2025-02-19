import { useQuery } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

const fetchMultipleDocs = async (uids) => {
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
  console.log('isquerhy enabled', userIds);

  return useQuery({
    queryKey: [USER_DATA_QUERY_KEY, userIds],
    queryFn: () => fetchMultipleDocs(userIds),
    enabled: isQueryEnabled.value,
    ...options,
  });
};

export default useUsersDataQuery;
