import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import * as Sentry from '@sentry/vue';
import { useAuthStore } from '@/store/auth';
import { getAuthService } from '@/services/AuthService';
import { SIGN_OUT_MUTATION_KEY } from '@/constants/mutationKeys';
import { APP_ROUTES } from '@/constants/routes';

/**
 * Sign-Out mutation.
 *
 * Signs out via the dashboard-owned AuthService. The onIdTokenChanged listener
 * fires with null, which clears firebaseUser and accessToken in the auth store.
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
      const authService = getAuthService();
      await authService.signOut();
    },
    onSuccess: async () => {
      // Cancel all actively fetching queries so they don't resolve into a
      // freshly-reset store.
      await queryClient.cancelQueries();

      // Reset store state. `meData` is no longer part of the auth store — it
      // lives in TanStack Query and is dropped by the `queryClient.clear()`
      // call below. The explicit `sessionStorage` removals defend against
      // persisted state surviving the reset on environments where the Pinia
      // persistence plugin races the redirect.
      authStore.$reset();
      sessionStorage.removeItem('authStore');
      sessionStorage.removeItem('gameStore');

      // Clear the query client to remove all cached data — this also drops
      // any cached `/me` payload.
      queryClient.clear();

      // Re-initialize Firekit for non-auth operations (Firestore, assessments),
      // so the next sign-in has a fresh firekit instance ready.
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
