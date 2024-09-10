import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { taskFetcher } from '@/helpers/query/tasks';
import { TASKS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Tasks query.
 *
 * @param {Boolean} [registeredTasksOnly=false] – Whether to fetch only registered tasks.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useTasksQuery = (registeredTasksOnly = false, queryOptions = undefined) => {
  const queryKey = toValue(registeredTasksOnly) ? [TASKS_QUERY_KEY, 'registered'] : [TASKS_QUERY_KEY];

  return useQuery({
    queryKey,
    queryFn: () => taskFetcher(registeredTasksOnly, true),
    ...queryOptions,
  });
};

export default useTasksQuery;
