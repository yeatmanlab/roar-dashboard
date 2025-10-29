import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { assignmentFetchAll } from '@/helpers/query/assignments';
import { ADMINISTRATION_ASSIGNMENTS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Administration assignments query.
 *
 * @param {String} administrationId – The administration ID.
 * @param {String} orgType – The organisation type.
 * @param {String} orgId – The organisation ID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAdministrationAssignmentsQuery = (administrationId, orgType, orgId, queryOptions = undefined) => {
  if (orgType === 'district') {
    return { isLoading: false, isFetching: false, data: [] };
  }
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  const queryConditions = [
    () => !!toValue(administrationId),
    () => !!toValue(orgType),
    () => !!toValue(orgId),
    () => !!toValue(roarUid),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [
      ADMINISTRATION_ASSIGNMENTS_QUERY_KEY,
      toValue(administrationId),
      `${toValue(orgType)}-${toValue(orgId)}`,
    ],
    queryFn: () => assignmentFetchAll(toValue(administrationId), toValue(orgType), toValue(orgId), true),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useAdministrationAssignmentsQuery;
