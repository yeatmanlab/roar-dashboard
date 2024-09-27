import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { SIGN_OUT_MUTATION_KEY } from '@/constants/mutationKeys';
import { APP_ROUTES } from '@/constants/routes';

/**
 * Sign-Out mutation.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useSignOutMutation = () => {
  const authStore = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: SIGN_OUT_MUTATION_KEY,
    mutationFn: async () => {
      await this.roarfirekit.signOut();
    },
    onSuccess: async () => {
      // Invalidate all queries.
      await queryClient.invalidateQueries();

      // Reset store and delete persisted data. Persisted data should be cleared via the $reset but to be safe, we also
      // remove it manually from sessionStorage to prevent any issues.
      authStore.$reset();
      sessionStorage.removeItem('authStore');
      sessionStorage.removeItem('gameStore');

      // Redirect to sign-in page.
      await router.push({ path: APP_ROUTES.SIGN_IN });

      // Clear the query client to remove all cached data.
      queryClient.clear();
    },
  });
};

export default useSignOutMutation;
