import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { USER_DATA_QUERY_KEY, USER_PROFILE_QUERY_KEY } from '@/constants/queryKeys';
import { USER_UPDATE_MUTATION_KEY } from '@/constants/mutationKeys';

/**
 * Update User mutation (backend API).
 *
 * Calls `PATCH /v1/users/:id` to partially update a user record and invalidates
 * the user queries on success. This is the API-backed replacement for the
 * Firestore `roarfirekit.updateUserData` write on the admin user-management
 * surface.
 *
 * The endpoint returns **204 No Content** on success — there is no response
 * body to unwrap, so the mutation resolves to `undefined`. Callers needing the
 * updated resource should rely on the query invalidation refetch.
 *
 * Expected mutate payload:
 *   `{ userId, userData }` where `userId` is the target user's UUID and
 *   `userData` is a body valid against `UpdateUserRequestBodySchema` (flat,
 *   camelCase, at least one field). Use `mapUserFormToUpdateBody` to build it
 *   from the edit form's model.
 *
 * On success both `USER_PROFILE_QUERY_KEY` (the API read) and the legacy
 * Firestore `'user'` key are invalidated so any still-mounted Firestore
 * consumers also refetch.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useUpdateUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: USER_UPDATE_MUTATION_KEY,
    mutationFn: async ({ userId, userData }) => {
      const client = getRoarApiClient();
      const result = await client.users.update({ params: { id: userId }, body: userData });

      if (result.status === StatusCodes.NO_CONTENT) {
        return undefined;
      }

      // Non-204 ts-rest results are surfaced as thrown errors so TanStack
      // routes them through `error`. The thrown shape carries the ts-rest
      // response so callers (e.g. the view's onError toast) can introspect it.
      const error = new Error(`Update user failed with status ${result.status}`);
      error.status = result.status;
      error.body = result.body;
      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_PROFILE_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [USER_DATA_QUERY_KEY] });
    },
  });
};

export default useUpdateUserMutation;
