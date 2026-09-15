import { QueryCache, QueryClient } from '@tanstack/vue-query';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { useGlobalError } from '@/composables/useGlobalError';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';
import { ME_QUERY_KEY } from '@/constants/queryKeys';

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
 * The QueryCache's `onError` is the **single** bridge between API errors and
 * `useGlobalError`. App.vue's `meError` watcher only handles navigation; it
 * does not write to global error state. Keeping the mapping in one place
 * prevents two surfaces from competing to set or clear the same flag.
 *
 * `useGlobalError` is module-scoped (its state is a `ref` outside any
 * component), so calling it from this non-component context is safe.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const { setGlobalError } = useGlobalError();
      if (isRosteringEndedError(error)) {
        setGlobalError({ type: GLOBAL_ERROR_TYPES.ROSTERING_ENDED });
        return;
      }
      if (isTerminalAuthError(error)) {
        setGlobalError({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
        return;
      }
      // Only treat the `/me` query as a global server error. Other queries
      // may have their own UI affordances for failure (retry buttons,
      // toasts, empty states) and shouldn't take the whole app down.
      if (Array.isArray(query?.queryKey) && query.queryKey[0] === ME_QUERY_KEY) {
        setGlobalError({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
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
