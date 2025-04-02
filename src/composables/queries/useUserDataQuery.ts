import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides.ts';
import { fetchDocById } from '@/helpers/query/utils';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';
import { computed, ComputedRef } from 'vue';

interface QueryOptions {
  enabled?: boolean;
  [key: string]: any;
}

/**
 * User profile data query.
 *
 * @param {string|undefined|null} userId – The user ID to fetch, set to a falsy value to fetch the current user.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryReturnType} The TanStack query result.
 */
const useUserDataQuery = (
  userId: string | undefined | null = undefined, 
  queryOptions?: QueryOptions
): UseQueryReturnType<any, Error> => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  const uid = computed(() => userId || roarUid.value);
  const queryConditions = [() => !!uid.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_DATA_QUERY_KEY, uid],
    queryFn: () => {
      if (!uid.value) throw new Error('User ID is required');
      return fetchDocById(FIRESTORE_COLLECTIONS.USERS, uid.value);
    },
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserDataQuery;
