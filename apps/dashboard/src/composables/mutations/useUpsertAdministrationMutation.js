import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { ADMINISTRATION_UPSERT_MUTATION_KEY } from '@/constants/mutationKeys';
import {
  ADMINISTRATIONS_QUERY_KEY,
  ADMINISTRATIONS_LIST_QUERY_KEY,
  ADMINISTRATION_ASSIGNMENTS_QUERY_KEY,
  ADMINISTRATION_TREE_QUERY_KEY,
  ADMINISTRATION_QUERY_KEY,
  ADMINISTRATION_ASSIGNEES_QUERY_KEY,
  ADMINISTRATION_TASK_VARIANTS_QUERY_KEY,
} from '@/constants/queryKeys';

/**
 * Upsert Administration mutation.
 *
 * Creates (`POST /administrations`, 201 → new id) or updates
 * (`PATCH /administrations/:id`, 200 → `{ id }`) an administration via the
 * backend API and invalidates the affected administration queries on success.
 *
 * @returns {Object} The mutation object returned by `useMutation`. The mutation
 *   accepts `{ administrationId?, body }` — when `administrationId` is present
 *   the administration is updated, otherwise a new one is created.
 */
const useUpsertAdministrationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ADMINISTRATION_UPSERT_MUTATION_KEY,
    mutationFn: async ({ administrationId, body }) => {
      const client = getRoarApiClient();

      if (administrationId) {
        const result = await client.administrations.update({ params: { id: administrationId }, body });
        if (result.status !== StatusCodes.OK) {
          const error = new Error(`Failed to update administration with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }
        return result.body.data;
      }

      const result = await client.administrations.create({ body });
      if (result.status !== StatusCodes.CREATED) {
        const error = new Error(`Failed to create administration with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }
      return result.body.data;
    },
    onSuccess: () => {
      // Invalidate the affected administration queries so reads reflect the write.
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATION_ASSIGNMENTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATION_TREE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATION_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATION_ASSIGNEES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATION_TASK_VARIANTS_QUERY_KEY] });
    },
  });
};

export default useUpsertAdministrationMutation;
