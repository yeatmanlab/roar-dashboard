import { useQuery, type UseQueryReturnType, type UseQueryOptions } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { computed, type MaybeRefOrGetter } from 'vue';

/**
 * User profile data query.
 *
 * @param userId – The user ID to fetch, set to a falsy value to fetch the current user.
 * @param queryOptions – Optional TanStack query options.
 * @returns The TanStack query result.
 */
const useUserDataQuery = (
  userId: MaybeRefOrGetter<string | undefined | null> = undefined,
  queryOptions?: UseQueryOptions,
): UseQueryReturnType => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  const uid = computed(() => userId || roarUid.value);
  const queryConditions = [() => !!uid.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_DATA_QUERY_KEY, uid],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USERS, uid),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserDataQuery;
