import { QueryCache, QueryClient } from '@tanstack/vue-query';
import { isMissingBaseUrlError, isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
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
 * `useGlobalError`. Navigation is equally centralized: the
 * `useGlobalErrorRedirect` watcher (installed in App.vue) redirects when
 * `globalError` changes on a settled route, and the router's `beforeEach`
 * guard enforces it on navigations. Keeping the mapping in one place
 * prevents two surfaces from competing to set or clear the same flag.
 *
 * `useGlobalError` is module-scoped (its state is a `ref` outside any
 * component), so calling it from this non-component context is safe.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      let type;
      if (isRosteringEndedError(error)) {
        type = GLOBAL_ERROR_TYPES.ROSTERING_ENDED;
      } else if (isTerminalAuthError(error)) {
        type = GLOBAL_ERROR_TYPES.AUTH_EXPIRED;
      } else if (isMissingBaseUrlError(error)) {
        // A missing base URL breaks every query in the app, not just `/me`, so
        // it takes the whole page to the error state regardless of which query
        // surfaced it first. Signing out won't help, but the page is at least
        // explicit instead of spinning.
        type = GLOBAL_ERROR_TYPES.SERVER_ERROR;
      } else if (Array.isArray(query?.queryKey) && query.queryKey[0] === ME_QUERY_KEY) {
        // Only treat the `/me` query as a global server error. Other queries
        // may have their own UI affordances for failure (retry buttons,
        // toasts, empty states) and shouldn't take the whole app down.
        type = GLOBAL_ERROR_TYPES.SERVER_ERROR;
      }
      if (!type) return;

      // Sentry captures console.error in production (captureConsoleIntegration
      // in sentry.js), and this bridge is the only handler on paths with no
      // bootstrap catch of their own — background `/me` refetches, the reload
      // path, and the missing-base-URL throw — so the log here is what makes
      // those failures observable at all.
      console.error('[Auth] API error escalated to the global error state', { type, queryKey: query?.queryKey }, error);

      const { setGlobalError } = useGlobalError();
      setGlobalError({ type });
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
        // Don't retry on terminal auth errors (unrecoverable), nor on a
        // missing base URL — that comes from the build, so it is terminal for
        // the page load and retrying only delays the error UI.
        if (isRosteringEndedError(error) || isTerminalAuthError(error) || isMissingBaseUrlError(error)) {
          return false;
        }
        // Deterministic behavior in Cypress E2E.
        if (window.Cypress) return false;
        return failureCount < 3;
      },
    },
  },
});
