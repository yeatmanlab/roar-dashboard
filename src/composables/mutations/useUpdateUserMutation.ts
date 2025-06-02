import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { UseMutationReturnType } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { USER_UPDATE_MUTATION_KEY } from '@/constants/mutationKeys';

interface UpdateUserParams {
  userId: string;
  userData: Record<string, any>;
}

/**
 * Update User mutation.
 *
 * TanStack mutation to update a user record and automatically invalidate the corresponding queries.
 * @TODO: Evaluate if we can apply optimistic updates to prevent invalidating/refetching the data.
 *
 * @returns The mutation object returned by `useMutation`.
 */
const useUpdateUserMutation = (): UseMutationReturnType<void, Error, UpdateUserParams, unknown> => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: USER_UPDATE_MUTATION_KEY,
    mutationFn: async ({ userId, userData }: UpdateUserParams): Promise<void> => {
      await authStore.roarfirekit.updateUserData(userId, userData);
    },
    onSuccess: (): void => {
      queryClient.invalidateQueries({ queryKey: [USER_DATA_QUERY_KEY] });
    },
  });
};

export default useUpdateUserMutation;
