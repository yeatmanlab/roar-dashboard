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
const useUserAssignmentsQuery = (queryOptions = undefined, userId = null, orgType = null, orgIds = null) => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);
  const uid = computed(() => userId || roarUid.value);
  const isSuperAdmin = authStore?.userClaims?.claims?.super_admin;
  const isExternalCallWithoutSuperAdmin = !isSuperAdmin && userId !== null;

  // We need to have the orgId and orgType for a non-superadmin call of an external fetch
  const queryConditions = [() => !!uid.value && (isExternalCallWithoutSuperAdmin ? orgType && orgIds : true)];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  console.log('enabled', isQueryEnabled.value);
  return useQuery({
    queryKey: [USER_ASSIGNMENTS_QUERY_KEY, uid, orgType, orgIds],
    queryFn: () => getUserAssignments(uid.value, orgType?.value, orgIds?.value),
    // Refetch on window focus for MEFS assessments as those are opened in a separate tab.
    refetchOnWindowFocus: 'always',
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserAssignmentsQuery;
