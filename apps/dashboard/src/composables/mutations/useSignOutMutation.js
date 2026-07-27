import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useRouter } from 'vue-router';
import * as Sentry from '@sentry/vue';
import { useAuthStore } from '@/store/auth';
import { getAuthService } from '@/services/AuthService';
import { SIGN_OUT_MUTATION_KEY } from '@/constants/mutationKeys';
import { APP_ROUTES } from '@/constants/routes';
import { IS_FIREBASE_EMULATOR_ENABLED } from '@/constants/firebase';

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

      // Local emulator: re-initializing Firekit client-side re-runs
      // connectAuthEmulator on the already-used Auth instance, which Firebase only
      // permits before the instance is used — the second call leaves auth broken
      // until a manual page refresh. That is the cause of the local "hang when
      // logging out and back in as a different user". A full reload to the sign-in
      // page gives the next sign-in a clean Firebase/Firekit init, exactly like the
      // manual refresh that currently works around it; `replace` (not `assign`) keeps
      // the signed-out page out of history so Back can't return to it. Gated on the
      // emulator flag, so deployed builds keep the client-side re-init + SPA redirect below.
      if (IS_FIREBASE_EMULATOR_ENABLED) {
        window.location.replace(APP_ROUTES.SIGN_IN);
        return;
      }

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
