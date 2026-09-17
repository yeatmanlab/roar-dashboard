import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { TASKS_QUERY_KEY } from '@/constants/queryKeys';
import { TASK_UPDATE_MUTATION_KEY } from '@/constants/mutationKeys';

/**
 * Update Task mutation.
 *
 * Calls `PATCH /tasks/:taskId` to update a task's mutable fields and
 * invalidates the tasks query on success so the catalog refetches.
 *
 * Expected mutate payload:
 *   `{ taskId, body }` where `taskId` is the task's UUID (or slug) and `body`
 *   mirrors `UpdateTaskRequestBodySchema` — a partial of
 *   `{ name, nameSimple, nameTechnical, description, image, tutorialVideo, taskConfig }`
 *   with at least one field present (the contract rejects empty bodies).
 *
 * @returns {Object} The mutation object returned by `useMutation`, resolving to `{ id }`.
 */
const useUpdateTaskMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [TASK_UPDATE_MUTATION_KEY],
    mutationFn: async ({ taskId, body }) => {
      const client = getRoarApiClient();
      const result = await client.tasks.update({ params: { taskId }, body });

      if (result.status === StatusCodes.OK) {
        return result.body.data;
      }

      // Non-200 ts-rest results are surfaced as thrown errors so TanStack
      // routes them through `error`. The thrown shape carries the ts-rest
      // response so callers (e.g. the form's onError toast) can introspect it.
      const error = new Error(`Update task failed with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

export default useUpdateTaskMutation;
