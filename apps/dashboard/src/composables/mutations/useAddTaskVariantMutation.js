import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { TASKS_QUERY_KEY, TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';
import { TASK_VARIANT_ADD_MUTATION_KEY } from '@/constants/mutationKeys';

/**
 * Add Task Variant mutation.
 *
 * TanStack mutation to add a task variant and automatically invalidate the corresponding queries.
 * @TODO: Evaluate if we can apply optimistic updates to prevent invalidating/refetching the data.
 * @TODO: Consider merging this with `useUpdateTaskVariantMutation` into a single `useUpsertTaskVariantMutation`.
 * Currently difficult to achieve due to the underlaying firekit functions being different.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */

const useAddTaskVariantMutation = () => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: TASK_VARIANT_ADD_MUTATION_KEY,
    mutationFn: async (variant) => {
      await authStore.roarfirekit.registerTaskVariant({ ...variant });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [TASK_VARIANTS_QUERY_KEY] });
    },
  });
};

export default useAddTaskVariantMutation;
