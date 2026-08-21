import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { TASKS_QUERY_KEY } from '@/constants/queryKeys';
import { TASK_ADD_MUTATION_KEY } from '@/constants/mutationKeys';

/**
 * Add Task mutation.
 *
 * Calls `POST /tasks` to create a task and invalidates the tasks query on
 * success so the catalog refetches without a manual reload.
 *
 * Expected mutate payload (mirrors `CreateTaskRequestBodySchema`):
 *   `{ slug, name, nameSimple, nameTechnical, taskConfig, description?, image?, tutorialVideo? }`
 *
 * @returns {Object} The mutation object returned by `useMutation`, resolving to `{ id }`.
 */
const useAddTaskMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [TASK_ADD_MUTATION_KEY],
    mutationFn: async (body) => {
      const client = getRoarApiClient();
      const result = await client.tasks.create({ body });

      if (result.status === StatusCodes.CREATED) {
        return result.body.data;
      }

      // Non-201 ts-rest results are surfaced as thrown errors so TanStack
      // routes them through `error`. The thrown shape carries the ts-rest
      // response so callers (e.g. the form's onError toast) can introspect it.
      const error = new Error(`Create task failed with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

export default useAddTaskMutation;
