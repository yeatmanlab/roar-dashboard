import { type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryReturnType, type UseQueryOptions } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_CLAIMS_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
/**
 * User claims data query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserClaimsQuery = (queryOptions?: UseQueryOptions): UseQueryReturnType => {
  const authStore = useAuthStore();
  const { getUserId } = authStore;

  const queryConditions = [() => !!getUserId()];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_CLAIMS_QUERY_KEY, getUserId()],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USER_CLAIMS, getUserId()),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserClaimsQuery;
