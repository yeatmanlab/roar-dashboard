import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getUserAssignments } from '@/helpers/query/assignments';
import { USER_ASSIGNMENTS_QUERY_KEY } from '@/constants/queryKeys';
import { computed } from 'vue';

/**
 * User assignments query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserAssignmentsQuery = (queryOptions = undefined, userId = null, orgType = null, orgId = null) => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);
  const uid = computed(() => userId || roarUid.value);
  console.log('queryuid', uid.value);

  const queryConditions = [() => !!uid.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_ASSIGNMENTS_QUERY_KEY, uid],
    queryFn: () => getUserAssignments(uid.value, orgType, orgId),
    // Refetch on window focus for MEFS assessments as those are opened in a separate tab.
    refetchOnWindowFocus: 'always',
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserAssignmentsQuery;
