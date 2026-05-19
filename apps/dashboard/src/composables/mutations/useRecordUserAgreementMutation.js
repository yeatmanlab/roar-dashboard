import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { USER_AGREEMENT_RECORD_MUTATION_KEY } from '@/constants/mutationKeys';
import { ME_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Record user agreement mutation.
 *
 * Calls `POST /users/:userId/agreements` to record the user's consent to a
 * specific agreement version. Used by the SignTos flow when a user accepts an
 * unsigned TOS in the `ConsentModal`.
 *
 * On success, invalidates the `/me` query so `meData.unsignedAgreements` is
 * refreshed; once the array is empty, the router's TOS guard releases the
 * user back to their original destination.
 *
 * Expected mutate payload:
 *   `{ userId: string, agreementVersionId: string }`
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useRecordUserAgreementMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [USER_AGREEMENT_RECORD_MUTATION_KEY],
    mutationFn: async ({ userId, agreementVersionId }) => {
      const client = getRoarApiClient();
      const result = await client.users.recordUserAgreement({
        params: { userId },
        body: { agreementVersionId },
      });

      if (result.status === StatusCodes.CREATED) {
        return result.body.data;
      }

      // Non-201 results bubble up as thrown errors so callers (the SignTos
      // container, or downstream `onError` hooks) can react. The thrown shape
      // mirrors the ts-rest response for downstream introspection.
      const error = new Error(`Record user agreement failed with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    onSuccess: () => {
      // Invalidate `/me` so `unsignedAgreements` reflects the new signature.
      // Once the array is empty, the router's TOS guard stops redirecting.
      queryClient.invalidateQueries({ queryKey: [ME_QUERY_KEY] });
    },
    onError: (error) => {
      // 409 Conflict means the user has already consented to this version.
      // That's not a real error — the backend is in sync, the frontend just
      // had stale state. Invalidate `/me` so the agreement drops off the
      // queue and the flow can advance.
      if (error?.status === StatusCodes.CONFLICT) {
        queryClient.invalidateQueries({ queryKey: [ME_QUERY_KEY] });
      }
    },
  });
};

export default useRecordUserAgreementMutation;
