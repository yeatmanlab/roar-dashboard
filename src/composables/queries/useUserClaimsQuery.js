import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_CLAIMS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
/**
 * User claims data query.
 *
 * @param {QueryOptions|undefined} queryParams – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserClaimsQuery = (queryParams = undefined) => {
  const authStore = useAuthStore();
  const { uid, userQueryKeyIndex } = storeToRefs(authStore);

  return useQuery({
    queryKey: [USER_CLAIMS_QUERY_KEY, uid.value, userQueryKeyIndex.value],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USER_CLAIMS, uid.value),
    ...queryParams,
  });
};

export default useUserClaimsQuery;
