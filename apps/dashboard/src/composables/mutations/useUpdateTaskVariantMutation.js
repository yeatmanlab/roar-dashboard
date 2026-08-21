import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';
import { TASK_VARIANT_UPDATE_MUTATION_KEY } from '@/constants/mutationKeys';

/**
 * Update Task Variant mutation.
 *
 * Calls `PATCH /tasks/:taskId/variants/:variantId` to update a variant's
 * mutable fields and invalidates the variant queries on success.
 *
 * The endpoint returns **204 No Content** on success — there is no response
 * body to unwrap, so the mutation resolves to `undefined`. Callers needing the
 * updated resource should rely on the query invalidation refetch.
 *
 * Expected mutate payload:
 *   `{ taskId, variantId, body }` where both ids are UUIDs (per the contract's
 *   update path params) and `body` mirrors `UpdateTaskVariantRequestBodySchema` —
 *   a partial of `{ name, description, status, parameters }` with at least one
 *   field present. Note `parameters` replaces the entire array (not a merge).
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useUpdateTaskVariantMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [TASK_VARIANT_UPDATE_MUTATION_KEY],
    mutationFn: async ({ taskId, variantId, body }) => {
      const client = getRoarApiClient();
      const result = await client.tasks.updateTaskVariant({ params: { taskId, variantId }, body });

      if (result.status === StatusCodes.NO_CONTENT) {
        return undefined;
      }

      // Non-204 ts-rest results are surfaced as thrown errors so TanStack
      // routes them through `error`. The thrown shape carries the ts-rest
      // response so callers (e.g. the form's onError toast) can introspect it.
      const error = new Error(`Update task variant failed with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_VARIANTS_QUERY_KEY] });
    },
  });
};

export default useUpdateTaskVariantMutation;
