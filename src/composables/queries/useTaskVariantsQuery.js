import { toValue } from 'vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { variantsFetcher } from '@/helpers/query/tasks';
import { TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Tasks Variants query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useTaskVariantsQuery = (registeredVariantsOnly = false, queryOptions = undefined) => {
  const queryClient = useQueryClient();
  const queryKey = toValue(registeredVariantsOnly)
    ? [TASK_VARIANTS_QUERY_KEY, 'registered']
    : [TASK_VARIANTS_QUERY_KEY, 'all'];
  const queryFn = () => variantsFetcher(registeredVariantsOnly);
  return {
    ...useQuery({
      queryKey: queryKey,
      queryFn: queryFn,
      ...queryOptions,
    }),
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_VARIANTS_QUERY_KEY, 'registered'] });
      queryClient.invalidateQueries({ queryKey: [TASK_VARIANTS_QUERY_KEY, 'all'] });
    },
  };
};

export default useTaskVariantsQuery;
