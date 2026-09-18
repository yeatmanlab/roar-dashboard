import { useAuthStore } from '@/store/auth';
import { getAuthService } from '@/services/AuthService';

/**
 * Auth callbacks for the assessment SDK's `initFirekitCompat` context.
 *
 * Single owner of the `{ getToken, refreshToken }` shape passed to every
 * task component, replacing the per-component inline literals that returned
 * the store's cached token. `getToken` resolves a live token via the
 * AuthService so a long-running assessment never sends a token that went
 * stale between trials; the cached store token is only the fallback when no
 * Firebase user is signed in (e.g. a race during sign-out).
 *
 * @returns {{ getToken: () => Promise<string | null>, refreshToken: () => Promise<string | null> }}
 */
export default function useAssessmentAuthCallbacks() {
  const authStore = useAuthStore();

  return {
    getToken: async () => {
      const liveToken = await getAuthService().getIdToken();
      return liveToken ?? authStore.accessToken;
    },
    refreshToken: () => authStore.forceIdTokenRefresh(),
  };
}
