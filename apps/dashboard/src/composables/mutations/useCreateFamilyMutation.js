import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { FAMILY_CREATE_MUTATION_KEY } from '@/constants/mutationKeys';
import { FAMILIES_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Create-family mutation.
 *
 * Calls `POST /v1/families/` to register a new caretaker and their family in a
 * single atomic backend call. This is the PUBLIC ROAR@Home registration entry
 * point — it runs before the caretaker is signed in, so the request carries no
 * auth token (the ts-rest client omits the `Authorization` header when the auth
 * store has no `accessToken`).
 *
 * Returns the new `{ id }` (the familyId) on success. The caretaker user id is
 * intentionally not returned by the endpoint; the registration saga obtains it
 * from `/me` after sign-in.
 *
 * Expected mutate payload:
 *   `{ body: { email, password, name: { first, last, middle? }, location? } }`
 *
 * Error mapping (thrown so the saga can branch on `error.status`):
 *   - 409 — email already in use (in `users` or Firebase Auth)
 *   - 422 — this caretaker already created a family ("one family per caretaker")
 *   - 400 / 429 / 500 — malformed / rate-limited / unexpected
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useCreateFamilyMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [FAMILY_CREATE_MUTATION_KEY],
    mutationFn: async ({ body }) => {
      const client = getRoarApiClient();
      const result = await client.families.create({ body });

      if (result.status === StatusCodes.CREATED) {
        return result.body.data;
      }

      // Non-201 results bubble up as thrown errors carrying the ts-rest
      // response so the registration saga can distinguish 409 (email in use)
      // from 422 (caretaker already has a family) and recover accordingly.
      const error = new Error(`Create family failed with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FAMILIES_QUERY_KEY] });
    },
  });
};

export default useCreateFamilyMutation;
