import { QueryCache, QueryClient } from '@tanstack/vue-query';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { useGlobalError } from '@/composables/useGlobalError';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';

/**
 * Singleton TanStack Query client.
 *
 * Lifted out of `plugins.js` so non-component code (the router's `beforeEach`
 * guard, in particular) can read cached query data via
 * `queryClient.getQueryData([KEY])` without going through Vue's composition
 * API. Created once at module load and consumed by:
 *
 *   - `plugins.js`, which passes it to `VueQueryPlugin`.
 *   - `router/index.js`, which inspects the `/me` cache to decide whether
 *     to redirect to the SignTos flow.
 *
 * The QueryCache's `onError` is the bridge between terminal API errors and
 * `useGlobalError` — when a query exhausts retries on `auth/rostering-ended`
 * or terminal auth codes, we surface the matching `GLOBAL_ERROR_TYPES` value
 * so the router can redirect to the appropriate error page.
 *
 * `useGlobalError` is module-scoped (its state is a `ref` outside any
 * component), so calling it from this non-component context is safe.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const { setGlobalError } = useGlobalError();
      if (isRosteringEndedError(error)) {
        setGlobalError({ type: GLOBAL_ERROR_TYPES.ROSTERING_ENDED });
      } else if (isTerminalAuthError(error)) {
        setGlobalError({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Cypress runs with no cache so each test starts from a fresh fetch.
      // `window.Cypress` is set by the Cypress runtime; outside of Cypress
      // we keep generous staleTime/gcTime so the dashboard doesn't refetch
      // /me et al. on every navigation.
      staleTime: window.Cypress ? 0 : 10 * 60 * 1000,
      gcTime: window.Cypress ? 0 : 15 * 60 * 1000,
      retry: (failureCount, error) => {
        // Don't retry on terminal auth errors (unrecoverable).
        if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
          return false;
        }
        // Deterministic behavior in Cypress E2E.
        if (window.Cypress) return false;
        return failureCount < 3;
      },
    },
  },
});
