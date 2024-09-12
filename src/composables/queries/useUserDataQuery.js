import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * User profile data query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserDataQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { roarUid, userQueryKeyIndex } = storeToRefs(authStore);

  const queryConditions = [() => !!roarUid.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_DATA_QUERY_KEY, roarUid.value, userQueryKeyIndex.value],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USERS, roarUid.value),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserDataQuery;
