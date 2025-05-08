import _isEmpty from 'lodash/isEmpty';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { taskFetcher, fetchByTaskId } from '@/helpers/query/tasks';
import { TASKS_QUERY_KEY } from '@/constants/queryKeys';
import { TOGGLE_REGISTERED_TASKS_MUTATION_KEY } from '@/constants/mutationKeys';

/**
 * Toggle registered tasks mutation
 *
 * Tanstack query to invalidate tasks query after mutation
 * Used to toggle registered tasks when updating tasks using the UpdateTaskForm component
 * @param {*} registeredTasksOnly
 * @param {*} taskIds
 * @returns
 */
const useToggleRegisteredTasksMutation = (registeredTasksOnly, taskIds) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [TOGGLE_REGISTERED_TASKS_MUTATION_KEY],
    mutationFn: () => {
      !_isEmpty(taskIds) ? () => fetchByTaskId(taskIds) : () => taskFetcher(registeredTasksOnly, true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY, 'registered'] });
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

export default useToggleRegisteredTasksMutation;
