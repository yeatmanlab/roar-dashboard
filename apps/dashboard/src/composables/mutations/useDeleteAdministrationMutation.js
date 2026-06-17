import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { ADMINISTRATION_DELETE_MUTATION_KEY } from '@/constants/mutationKeys';
import {
  ADMINISTRATIONS_QUERY_KEY,
  ADMINISTRATIONS_LIST_QUERY_KEY,
  ADMINISTRATION_ASSIGNMENTS_QUERY_KEY,
} from '@/constants/queryKeys';

/**
 * Delete Administration mutation.
 *
 * TanStack mutation that deletes an administration via `DELETE /administrations/:id`
 * (204 on success) and invalidates the affected administration queries.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useDeleteAdministrationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ADMINISTRATION_DELETE_MUTATION_KEY,
    mutationFn: async (administrationId) => {
      const client = getRoarApiClient();
      const result = await client.administrations.delete({ params: { id: administrationId } });

      if (result.status !== StatusCodes.NO_CONTENT) {
        const error = new Error(`Failed to delete administration with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate the queries to refetch the administration data.
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATION_ASSIGNMENTS_QUERY_KEY] });
    },
  });
};

export default useDeleteAdministrationMutation;
