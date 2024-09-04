import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { TASKS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Add Task mutation.
 *
 * TanStack mutation to add a task variant and automatically invalidate the corresponding queries.
 * @TODO: Evaluate if we can apply optimistic updates to prevent invalidating/refetching the data.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */

const useAddTaskMutation = () => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task) => {
      await authStore.roarfirekit.registerTaskVariant({ ...task });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

export default useAddTaskMutation;
