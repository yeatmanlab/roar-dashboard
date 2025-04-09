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
 * @param {String|undefined} userId – If this is passed in, return the assignments for the student under this adminUid.
 * @param {String|undefined} orgType– The orgtype that is shared between the admin user and the target studnet user
 * @param {String|undefined} orgId – The orgId that is shared between the admin user and the target studnet user
 * OrgType and OrgId are passed in in order to construct a query that will validate the administrator's permissions to view target user data
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserAssignmentsQuery = (queryOptions = undefined, userId = null, orgType = null, orgIds = null) => {
  const authStore = useAuthStore();
  const { roarUid, userData } = storeToRefs(authStore);
  const uid = computed(() => userId ?? roarUid.value);
  const isSuperAdmin = authStore?.userClaims?.claims?.super_admin;
  const isExternalCallWithoutSuperAdmin = !isSuperAdmin && userId !== null;
  const isTestUser = userData.value?.testData ?? false;

  // We need to have the orgId and orgType for a non-superadmin call of an external fetch
  const queryConditions = [() => !!uid.value && (isExternalCallWithoutSuperAdmin ? orgType && orgIds : true)];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_ASSIGNMENTS_QUERY_KEY, uid, orgType, orgIds],
    queryFn: () =>
      getUserAssignments({
        roarUid: uid.value,
        orgType: orgType?.value,
        orgIds: orgIds?.value,
        isTestUser,
      }),
    // Refetch on window focus for MEFS assessments as those are opened in a separate tab.
    refetchOnWindowFocus: 'always',
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserAssignmentsQuery;
