import { useQuery, keepPreviousData } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
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

  return useQuery({
    queryKey: [USER_DATA_QUERY_KEY, roarUid.value, userQueryKeyIndex.value],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USERS, roarUid.value),
    placeholderData: keepPreviousData,
    ...queryOptions,
  });
};

export default useUserDataQuery;