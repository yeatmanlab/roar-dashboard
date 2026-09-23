import { useAuthStore } from '@/store/auth';
import { getAuthService } from '@/services/AuthService';

/**
 * Auth callbacks for the assessment SDK's `initFirekitCompat` context.
 *
 * Single owner of the `{ getToken, refreshToken }` shape passed to every
 * task component, replacing the per-component inline literals that returned
 * the store's cached token. `getToken` resolves a live token via the
 * AuthService so a long-running assessment never sends a token that went
 * stale between trials. It resolves null when no Firebase user is signed
 * in — deliberately no fallback to the store's cached token, so a
 * signed-out session cannot keep authenticating SDK requests.
 *
 * @returns {{ getToken: () => Promise<string | null>, refreshToken: () => Promise<string | null> }}
 */
export default function useAssessmentAuthCallbacks() {
  const authStore = useAuthStore();

  return {
    getToken: () => getAuthService().getIdToken(),
    refreshToken: () => authStore.forceIdTokenRefresh(),
  };
}
