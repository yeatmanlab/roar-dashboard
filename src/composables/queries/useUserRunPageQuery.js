import { computed, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { runPageFetcher } from '@/helpers/query/runs';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { USER_RUN_PAGE_QUERY_KEY } from '@/constants/queryKeys';

/**
 * User run page query
 *
 * @TODO: Evaluate whether this query can be replaced using more generic query that already fetches user assessments and
 * scores. This query was implemented as part of the transition to query composables but might be redudant if we
 * refactor the underlying database query helpers to fetch all necessary data in a single query.
 *
 * @param {string|undefined|null} userId – The user ID to fetch, set to a falsy value to fetch the current user.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useUserRunPageQuery = (userId, administrationId, orgType, orgId, queryOptions = undefined) => {
  const optionalAssessments = computed(() => []);

  const queryConditions = [() => !!toValue(userId), () => !!toValue(orgType), () => !!toValue(orgId)];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  // Get select fields from queryFnOptions or use default
  const selectFields = options?.queryFnOptions?.select || [
    'scores.computed',
    'taskId',
    'reliable',
    'engagementFlags',
    'optional',
  ];
  console.log('Select fields:', selectFields);

  return useQuery({
    queryKey: [USER_RUN_PAGE_QUERY_KEY, userId, administrationId, orgType, orgId],
    queryFn: async () => {
      console.log('Fetching run page data with:', { userId, administrationId, orgType, orgId });
      const runPageData = await runPageFetcher({
        administrationId: administrationId,
        orgType: orgType,
        orgId: orgId,
        userId: userId,
        select: selectFields,
        scoreKey: 'scores.computed',
        paginate: false,
      });
      console.log('Run page data received:', runPageData);

      const data = runPageData?.map((task) => {
        const isOptional = optionalAssessments?.value?.some((assessment) => assessment.taskId === task.taskId);
        return isOptional ? { ...task, optional: true } : task;
      });

      return data;
    },
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserRunPageQuery;
