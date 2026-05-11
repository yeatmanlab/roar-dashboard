import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import * as Sentry from '@sentry/vue';
import { useAuthStore } from '@/store/auth';
import { SIGN_OUT_MUTATION_KEY } from '@/constants/mutationKeys';
import { ME_QUERY_KEY } from '@/constants/queryKeys';
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
      await authStore.roarfirekit.signOut();
    },
    onSuccess: async () => {
      // Cancel all actively fetching queries.
      await queryClient.cancelQueries();

      // Drop any cached `/me` payload before the store reset, so a fast
      // re-sign-in (different user) doesn't transiently see the previous
      // user's data through the watcher in `App.vue` while the new `/me`
      // request is in flight.
      queryClient.removeQueries({ queryKey: [ME_QUERY_KEY] });

      // Reset store and delete persisted data. Persisted data should be cleared via the $reset but to be safe, we also
      // remove it manually from sessionStorage to prevent any issues.
      // `$reset` already nulls `meData` since it's part of state, but the explicit `clearMeData()` is kept as
      // belt-and-suspenders against any future state-shape changes that might cause `$reset()` to miss it.
      authStore.clearMeData();
      authStore.$reset();
      sessionStorage.removeItem('authStore');
      sessionStorage.removeItem('gameStore');

      // Clear the query client to remove all cached data.
      queryClient.clear();

      // Re-initialize Firekit. This is necessary to ensure that Firekit is properly reset after
      // sign-out in order to allow a new user to sign in.
      await authStore.initFirekit();

      // Redirect to sign-in page.
      router.push({ path: APP_ROUTES.SIGN_IN });
    },
    onError: (err) => {
      Sentry.captureException(err);
    },
  });
};

export default useSignOutMutation;
