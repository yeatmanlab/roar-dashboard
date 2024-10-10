import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';
import { USER_UPDATE_MUTATION_KEY } from '@/constants/mutationKeys';

/**
 * Update User mutation.
 *
 * TanStack mutation to update a user record and automatically invalidate the corresponding queries.
 * @TODO: Evaluate if we can apply optimistic updates to prevent invalidating/refetching the data.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useUpdateUserMutation = () => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: USER_UPDATE_MUTATION_KEY,
    mutationFn: async ({ userId, userData }) => {
      await authStore.roarfirekit.updateUserData(userId, userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_DATA_QUERY_KEY] });
    },
  });
};

export default useUpdateUserMutation;
