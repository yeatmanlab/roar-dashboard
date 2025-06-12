import { useQueries } from '@tanstack/vue-query';
import { computed, toValue } from 'vue';
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
  const authStore = useAuthStore();
  const { userData } = storeToRefs(authStore);
  const isSuperAdmin = authStore?.userClaims?.claims?.super_admin ?? false;
  const isTestUser = userData.value?.testData ?? false;
  const isExternalCallWithoutSuperAdmin = !isSuperAdmin;
  const resolvedUserIds = toValue(userIds);

  // We need to have the orgId and orgType for a non-superadmin call
const hasUserIds = toValue(userIds).length > 0;
const needsOrgCheck = isExternalCallWithoutSuperAdmin;
const hasOrgDetails = orgType && orgIds;

const queryConditions = [
  () => hasUserIds && (needsOrgCheck ? hasOrgDetails : true),
];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  // Create queries array as a computed to handle reactive userIds
  const queries = computed(() => {
    return resolvedUserIds.map((userId) => ({
      queryKey: [MULTIPLE_USER_ASSIGNMENTS_QUERY_KEY, userId, toValue(orgType), toValue(orgIds)],
      queryFn: () => getUserAssignments(userId, toValue(orgType), toValue(orgIds), isTestUser),
      refetchOnWindowFocus: 'always',
      enabled: isQueryEnabled,
      ...options,
    }));
  });

  const results = useQueries({ queries: queries.value });

  // Compute a map of userId to assignments
  const assignmentsMap = computed(() => {
    const map = {};

    if (results.value) {
      results.value.forEach((result, index) => {
        const userId = resolvedUserIds[index];
        map[userId] = result.status === 'success' && result.data ? result.data : [];
      });
    }

    return map;
  });

  return {
    ...results,
    data: assignmentsMap,
  };
};

export default useMultipleUserAssignmentsQuery;
