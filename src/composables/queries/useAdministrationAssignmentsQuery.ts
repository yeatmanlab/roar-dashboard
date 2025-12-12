import { type MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';
import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
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
 * @param {Boolean} includeSurveyResponses – Whether to fetch surveyResponses
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAdministrationAssignmentsQuery = (
  administrationId,
  orgType,
  orgId,
  includeSurveyResponses: MaybeRefOrGetter<boolean> = false,
  queryOptions?: UseQueryOptions,
): UseQueryReturnType => {
  const authStore = useAuthStore();
  const { getUserId } = authStore;

  const queryConditions = [
    () => !!toValue(administrationId),
    () => !!toValue(orgType),
    () => !!toValue(orgId),
    () => !!toValue(getUserId()),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [
      ADMINISTRATION_ASSIGNMENTS_QUERY_KEY,
      administrationId,
      `${orgType}-${orgId}`,
      toValue(includeSurveyResponses),
    ],
    queryFn: () => assignmentFetchAll(administrationId, orgType, orgId, true, toValue(includeSurveyResponses)),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useAdministrationAssignmentsQuery;
