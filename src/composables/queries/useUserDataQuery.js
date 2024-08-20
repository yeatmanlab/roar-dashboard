import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
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
const useUserDataQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { uid, userQueryKeyIndex } = storeToRefs(authStore);

  return useQuery({
    queryKey: [USER_DATA_QUERY_KEY, uid.value, userQueryKeyIndex.value],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USERS, uid.value),
    ...queryOptions,
  });
};

export default useUserDataQuery;
