import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { UseMutationReturnType } from '@tanstack/vue-query';
import { USER_UPDATE_MUTATION_KEY } from '@/constants/mutationKeys';
import { SITE_OVERVIEW_QUERY_KEY, USER_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';

interface UpdateUserParams {
  userId: string;
  userData: Record<string, any>;
}

// NOT used. Todo: Refactor to update users how we want

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
      // Method no longer exists. Todo: Refactor to update users how we want
      await authStore.roarfirekit.updateUserData(userId, userData);
    },
    onSuccess: (): void => {
      // NB: This invalidation is too broad, but siteId is not available w/o refactoring
      queryClient.invalidateQueries({ queryKey: [SITE_OVERVIEW_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [USER_DATA_QUERY_KEY] });
    },
  });
};

export default useUpdateUserMutation;
