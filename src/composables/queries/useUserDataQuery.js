import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
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

  // Ensure all necessary data is loaded before enabling the query.
  const isQueryEnabled = computed(() => {
    const enabled = queryOptions?.enabled;
    return !!roarUid.value && (enabled === undefined ? true : enabled);
  });

  // Remove the enabled property from the query options to avoid overriding the computed value.
  const options = queryOptions ? { ...queryOptions } : {};
  delete options.enabled;

  return useQuery({
    queryKey: [USER_DATA_QUERY_KEY, roarUid.value, userQueryKeyIndex.value],
    queryFn: () => fetchDocById(FIRESTORE_COLLECTIONS.USERS, roarUid.value),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserDataQuery;
