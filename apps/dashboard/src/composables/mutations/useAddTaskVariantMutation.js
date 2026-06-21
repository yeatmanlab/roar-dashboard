import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';
import { TASK_VARIANT_ADD_MUTATION_KEY } from '@/constants/mutationKeys';

/**
 * Add Task Variant mutation.
 *
 * Calls `POST /tasks/:taskId/variants` to create a variant and invalidates the
 * variant queries on success (the prefix match covers both the per-task list
 * and the legacy cross-task list still used by administration creation).
 *
 * Expected mutate payload:
 *   `{ taskId, body }` where `taskId` is the parent task's UUID (the create
 *   endpoint's path param requires a UUID, not a slug) and `body` mirrors
 *   `CreateTaskVariantRequestBodySchema`:
 *   `{ name?, parameters?, description?, status }`
 *
 * @returns {Object} The mutation object returned by `useMutation`, resolving to `{ id }`.
 */
const useAddTaskVariantMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [TASK_VARIANT_ADD_MUTATION_KEY],
    mutationFn: async ({ taskId, body }) => {
      const client = getRoarApiClient();
      const result = await client.tasks.createTaskVariant({ params: { taskId }, body });

      if (result.status === StatusCodes.CREATED) {
        return result.body.data;
      }

      // Non-201 ts-rest results are surfaced as thrown errors so TanStack
      // routes them through `error`. The thrown shape carries the ts-rest
      // response so callers (e.g. the form's onError toast) can introspect it.
      const error = new Error(`Create task variant failed with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_VARIANTS_QUERY_KEY] });
    },
  });
};

export default useAddTaskVariantMutation;
