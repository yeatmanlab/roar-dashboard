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

  return {
    ...useQuery({
      queryKey: [TASK_VARIANTS_QUERY_KEY, toValue(registeredVariantsOnly) ? 'registered' : 'all'],
      queryFn: () => variantsFetcher(registeredVariantsOnly),
      ...queryOptions,
    }),
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_VARIANTS_QUERY_KEY, 'registered'] });
      queryClient.invalidateQueries({ queryKey: [TASK_VARIANTS_QUERY_KEY] });
    },
  };
};

export default useTaskVariantsQuery;
