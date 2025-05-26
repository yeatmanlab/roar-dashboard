import { useMutation, useQueryClient } from "@tanstack/vue-query";
import type { UseMutationReturnType } from "@tanstack/vue-query";
import { useAuthStore } from "@/store/auth";
import { TASKS_QUERY_KEY } from "@/constants/queryKeys";
import { TASK_UPDATE_MUTATION_KEY } from "@/constants/mutationKeys";

interface TaskData {
  [key: string]: any;
}

/**
 * Update Task mutation.
 *
 * TanStack mutation to update a task and automatically invalidate the corresponding queries.
 * @TODO: Evaluate if we can apply optimistic updates to prevent invalidating/refetching the data.
 * @TODO: Consider merging this with `useAddTaskMutation` into a single `useUpsertTaskMutation`. Currently difficult to
 * achieve due to the underlaying firekit functions being different.
 *
 * @returns The mutation object returned by `useMutation`.
 */

const useUpdateTaskMutation = (): UseMutationReturnType<
  void,
  Error,
  TaskData,
  unknown
> => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: TASK_UPDATE_MUTATION_KEY,
    mutationFn: async (task: TaskData): Promise<void> => {
      await authStore.roarfirekit.updateTaskOrVariant(task);
    },
    onSuccess: (): void => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

export default useUpdateTaskMutation;
