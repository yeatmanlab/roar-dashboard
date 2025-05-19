import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_CHILD_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * User child data query.
 *
 * @TODO: Evaluate wether this query can be replaced by the existing useUserDataQuery composable.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserChildDataQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  // Ensure all necessary data is loaded before enabling the query.
  const queryConditions = [() => !!roarUid.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_CHILD_DATA_QUERY_KEY, roarUid],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USERS, roarUid, ['studentData', 'birthMonth', 'birthYear']),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserChildDataQuery;
