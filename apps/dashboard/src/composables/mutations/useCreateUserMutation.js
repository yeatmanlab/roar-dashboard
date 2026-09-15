import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { getRoarApiClient } from '@/clients/roar-api';
import { USER_CREATE_MUTATION_KEY } from '@/constants/mutationKeys';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Create User mutation.
 *
 * Creates a user via the backend `POST /users` endpoint (`201 → { id }`) and
 * invalidates the user data queries on success so any user reads reflect the
 * write. The mutation is currently used by the create-administrator form to
 * create staff/admin accounts (a chosen role assigned across the selected org
 * memberships), but the endpoint creates any user type, so this composable
 * stays generic and accepts the full `POST /users` body.
 *
 * @returns {Object} The mutation object returned by `useMutation`. The mutation
 *   accepts the full `POST /users` request body (`email`, `password`, `name`,
 *   `userType`, `memberships`, …) already shaped for the create schema.
 */
const useCreateUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [USER_CREATE_MUTATION_KEY],
    mutationFn: async (body) => {
      const client = getRoarApiClient();
      const result = await client.users.create({ body });

      if (result.status !== StatusCodes.CREATED) {
        const error = new Error(`Failed to create user with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      return result.body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_DATA_QUERY_KEY] });
    },
  });
};

export default useCreateUserMutation;
