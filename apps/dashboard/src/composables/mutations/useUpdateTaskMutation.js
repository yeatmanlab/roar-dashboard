import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { TASKS_QUERY_KEY } from '@/constants/queryKeys';
import { TASK_UPDATE_MUTATION_KEY } from '@/constants/mutationKeys';

/**
 * Update Task mutation.
 *
 * TanStack mutation to update a task and automatically invalidate the corresponding queries.
 * @TODO: Evaluate if we can apply optimistic updates to prevent invalidating/refetching the data.
 * @TODO: Consider merging this with `useAddTaskMutation` into a single `useUpsertTaskMutation`. Currently difficult to
 * achieve due to the underlaying firekit functions being different.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */

const useUpdateTaskMutation = () => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: TASK_UPDATE_MUTATION_KEY,
    mutationFn: async (task) => {
      await authStore.roarfirekit.updateTaskOrVariant(task);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

export default useUpdateTaskMutation;
