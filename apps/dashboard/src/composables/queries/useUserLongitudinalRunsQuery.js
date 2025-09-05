import { useQuery } from '@tanstack/vue-query';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { runPageFetcher } from '@/helpers/query/runs';
import { USER_LONGITUDINAL_RUNS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Query hook for fetching a user's runs across multiple administrations
 * 
 * @param {string} userId - The user ID to fetch runs for
 * @param {string} orgType - The organization type
 * @param {string} orgId - The organization ID
 * @param {Object} queryOptions - Optional query configuration
 * @returns {UseQueryResult} The query result containing the user's runs
 */
const useUserLongitudinalRunsQuery = (userId, orgType, orgId, queryOptions = undefined) => {
  // Ensure all necessary data is loaded before enabling the query
  const queryConditions = [
    () => !!userId,
    () => !!orgType,
    () => !!orgId,
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [USER_LONGITUDINAL_RUNS_QUERY_KEY, userId, orgType, orgId],
    queryFn: () => runPageFetcher({
      userId,
      orgType,
      orgId,
      paginate: false,
      select: ['scores.computed.composite', 'taskId', 'dateCreated', 'assignmentId'],
    }),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useUserLongitudinalRunsQuery;
