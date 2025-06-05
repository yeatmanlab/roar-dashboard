import { useQueries } from '@tanstack/vue-query';
import { computed, toValue, unref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getUserAssignments } from '@/helpers/query/assignments';
import { MULTIPLE_USER_ASSIGNMENTS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Multiple user assignments query that returns a map of userId to assignments.
 *
 * @param {String[]} userIds - Array of user IDs to fetch assignments for
 * @param {String|undefined} orgType - The orgtype that is shared between the admin user and the target student users
 * @param {String|undefined} orgIds - The orgIds that are shared between the admin user and the target student users
 * @param {QueryOptions|undefined} queryOptions - Optional TanStack query options
 * @returns {UseQueriesResult & { data: ComputedRef<Record<string, any[]>> }} The TanStack queries result with a computed map of userId to assignments
 */
const useMultipleUserAssignmentsQuery = (userIds = [], orgType = null, orgIds = null, queryOptions = undefined) => {
  console.log('orgIds', toValue(orgIds));
  const authStore = useAuthStore();
  const { userData } = storeToRefs(authStore);
  const isSuperAdmin = authStore?.userClaims?.claims?.super_admin;
  const isTestUser = userData.value?.testData ?? false;
  const isExternalCallWithoutSuperAdmin = !isSuperAdmin;

  // We need to have the orgId and orgType for a non-superadmin call
  const queryConditions = [
    () => toValue(userIds).length > 0 && (isExternalCallWithoutSuperAdmin ? orgType && orgIds : true),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  const queries = toValue(userIds).map((userId) => ({
    queryKey: [MULTIPLE_USER_ASSIGNMENTS_QUERY_KEY, toValue(userId)],
    queryFn: () => getUserAssignments(userId, toValue(orgType), toValue(orgIds), isTestUser),
    refetchOnWindowFocus: 'always',
    enabled: isQueryEnabled,
    ...options,
  }));
  console.log('queries', queries);

  const results = useQueries({ queries });
  console.log('results', results);

  // Compute a map of userId to assignments
  const assignmentsMap = computed(() => {
    const map = {};
    // results.value is an array of individual query results
    if (results.value) {
      results.value.forEach((result, index) => {
        const userId = toValue(userIds[index]);
        map[userId] = result.data ?? [];
      });
    }
    return map;
  });
  console.log('assignments', assignmentsMap.value);

  return {
    ...results,
    data: assignmentsMap,
  };
};

export default useMultipleUserAssignmentsQuery;
