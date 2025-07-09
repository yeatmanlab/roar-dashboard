import { useQuery } from '@tanstack/vue-query';
import { fetchTaskGroups } from '@/helpers/query/tasks';
import { TASK_BUNDLES_QUERY_KEY } from '@/constants/queryKeys';
import { useQueryClient } from '@tanstack/vue-query';

const useTaskBundlesQuery = (queryOptions = undefined) => {
  console.log('useTaskBundlesQuery invoked');
  const queryClient = useQueryClient();
  const queryFn = () => fetchTaskGroups();
  return {
    ...useQuery({
      queryKey: [TASK_BUNDLES_QUERY_KEY],
      queryFn: queryFn,
      ...queryOptions,
    }),
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_BUNDLES_QUERY_KEY] });
    },
  };
};

export default useTaskBundlesQuery;
