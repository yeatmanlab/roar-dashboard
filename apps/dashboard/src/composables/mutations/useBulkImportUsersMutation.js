import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { USER_BULK_IMPORT_MUTATION_KEY } from '@/constants/mutationKeys';
import { USER_DATA_QUERY_KEY, ORG_USERS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Bulk Import Users mutation.
 *
 * Submits one chunk of import rows (up to the backend's 100-row cap) to the
 * `POST /users/import` endpoint. The endpoint always resolves `200` with a
 * per-row multi-status body — create/update/unenroll outcomes, including
 * per-row failures, live in `results` rather than the HTTP status. Callers
 * that submit multiple chunks call `mutateAsync` once per chunk and inspect
 * `results` themselves to report per-row success/failure.
 *
 * @returns {Object} The mutation object returned by `useMutation`. The mutation
 *   accepts `{ users }` — the `POST /users/import` request body — and resolves
 *   to the per-row `results` array on success.
 */
const useBulkImportUsersMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [USER_BULK_IMPORT_MUTATION_KEY],
    mutationFn: async (body) => {
      const client = getRoarApiClient();
      const result = await client.users.bulkImport({ body });

      if (result.status !== StatusCodes.OK) {
        const error = new Error(`Failed to bulk import users with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      return result.body.data.results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_DATA_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ORG_USERS_QUERY_KEY] });
    },
  });
};

export default useBulkImportUsersMutation;
