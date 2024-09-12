import { computed, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { getUserAssignments } from '@/helpers/query/assignments';
import { USER_ASSIGNMENTS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * User assignments query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserAssignmentsQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  const isQueryEnabled = computed(() => !!roarUid.value && (toValue(queryOptions?.enabled) ?? true));

  const options = queryOptions ? { ...queryOptions } : {};
  delete options.enabled;

  return useQuery({
    queryKey: [USER_ASSIGNMENTS_QUERY_KEY],
    queryFn: () => getUserAssignments(roarUid.value),
    // Refetch on window focus for MEFS assessments as those are opened in a separate tab.
    refetchOnWindowFocus: 'always',
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserAssignmentsQuery;
