import { toValue } from 'vue';
import { storeToRefs } from 'pinia';
import { useQuery } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { hasArrayEntries } from '@/helpers/hasArrayEntries';
import { ADMINISTRATIONS_STATS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Administrations stats query using firekit getAssignmentStats method.
 *
 * @param {ref<Array<String>>} administrationIds – A Vue ref containing an array of administration IDs to fetch.
 * @param {ref<String>} orgId – A Vue ref containing the org ID for filtering stats.
 * @param {ref<String>} orgType – A Vue ref containing the singular org type (required if orgId is provided).
 * @param {ref<Array<String>>} taskIds – Optional array of task IDs to get task-specific stats (null for assignment-level stats).
 * @param {ref<Boolean>} fetchAllTaskIds – If true, fetch all taskIds from each administration's assessments field (ignores taskIds parameter).
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAdministrationsStatsQuery = (
  administrationIds,
  orgId,
  orgType,
  taskIds = null,
  fetchAllTaskIds = false,
  queryOptions = undefined,
) => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);

  // Ensure all necessary data is available before enabling the query.
  const conditions = [() => hasArrayEntries(administrationIds), () => roarfirekit.value?.getAssignmentStats];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATIONS_STATS_QUERY_KEY, administrationIds, orgId, orgType, taskIds, fetchAllTaskIds],
    queryFn: async () => {
      const params = {
        administrationIds: toValue(administrationIds),
      };

      // Add orgId and orgType if provided
      const orgIdValue = toValue(orgId);
      const orgTypeValue = toValue(orgType);
      
      // Validate that orgType is provided when orgId is provided
      if (orgIdValue && !orgTypeValue) {
        throw new Error('orgType is required when orgId is provided');
      }
      
      if (orgIdValue && orgTypeValue) {
        params.orgId = orgIdValue;
        params.orgType = orgTypeValue;
      }

      // Add taskIds if provided
      const taskIdsValue = toValue(taskIds);
      if (taskIdsValue) {
        params.taskIds = taskIdsValue;
      }

      // Add fetchAllTaskIds if true
      const fetchAllTaskIdsValue = toValue(fetchAllTaskIds);
      if (fetchAllTaskIdsValue) {
        params.fetchAllTaskIds = fetchAllTaskIdsValue;
      }

      const { data } = await roarfirekit.value.getAssignmentStats(params);

      // Return stats in the same format as before (array of stats objects)
      return toValue(administrationIds).map((adminId) => data[adminId]);
    },
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useAdministrationsStatsQuery;
