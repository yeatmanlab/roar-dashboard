import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { FAMILY_ADD_CHILDREN_MUTATION_KEY } from '@/constants/mutationKeys';
import { FAMILIES_QUERY_KEY, USER_DATA_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Add-family-children mutation.
 *
 * Calls `POST /v1/families/:familyId/users` to add one or more children to an
 * existing family. Authenticated: the signed-in caretaker (or a super admin)
 * must be a parent of the target family. All DB writes commit atomically; on
 * failure the backend rolls back any Firebase Auth accounts it created.
 *
 * Returns `{ ids }` — the new child user ids in request order.
 *
 * Note: consent is NOT part of this request (the families contract intentionally
 * drops `consentData`). Per-child consent/assent is administration-specific and
 * is handled post-auth by the per-administration consent gate — not at account
 * creation.
 *
 * Expected mutate payload:
 *   `{ familyId, body: { children: [{ email, password, name, dob, grade, activationCode, demographics? }] } }`
 *
 * Error mapping (thrown so the saga can branch on `error.status`):
 *   - 409 — a child email is already in use
 *   - 422 — an activation code is invalid/expired, or the family-size cap (12) exceeded
 *   - 400 / 401 / 403 / 404 / 429 / 500
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useAddFamilyChildrenMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [FAMILY_ADD_CHILDREN_MUTATION_KEY],
    mutationFn: async ({ familyId, body }) => {
      const client = getRoarApiClient();
      const result = await client.families.addChildren({ params: { familyId }, body });

      if (result.status === StatusCodes.CREATED) {
        return result.body.data;
      }

      const error = new Error(`Add family children failed with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    onSuccess: () => {
      // The parent dashboard still derives its children list from the legacy
      // user-data query; invalidate it (and the families query) so the newly
      // added children surface once that view is refetched.
      queryClient.invalidateQueries({ queryKey: [USER_DATA_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [FAMILIES_QUERY_KEY] });
    },
  });
};

export default useAddFamilyChildrenMutation;
