import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
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
const useUserClaimsQuery = ({ userId = null, ...queryOptions } = {}) => {
  const authStore = useAuthStore();
  const { uid } = storeToRefs(authStore);

  // Use provided userId or fall back to current user's uid
  const targetUserId = computed(() => userId || uid.value);

  const queryConditions = [() => !!targetUserId.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_CLAIMS_QUERY_KEY, targetUserId],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USER_CLAIMS, targetUserId),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserClaimsQuery;
