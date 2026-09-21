import { watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGlobalError } from '@/composables/useGlobalError';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';
import { APP_ROUTE_NAMES } from '@/constants/routes';

/**
 * Redirects to the matching error page whenever `globalError` is set.
 *
 * `setGlobalError` only writes a ref — the router's `beforeEach` guard reads
 * it, but the guard runs on navigations only. Errors that arrive while the
 * user sits on a settled route (a Firekit init failure after the initial
 * navigation, a background query escalated by the QueryCache `onError`
 * bridge) would otherwise leave the user on the current page until something
 * else triggers a navigation. This watcher is the app-level counterpart to
 * the guard: same type → route mapping, applied immediately on change.
 *
 * The mapping stays in `queryClient.js` (error → `globalError` type); this
 * composable only translates the resulting state into a navigation, using
 * `router.replace` so the abandoned route doesn't linger in history.
 *
 * @returns {void}
 */
export function useGlobalErrorRedirect() {
  const route = useRoute();
  const router = useRouter();
  const { globalError, clearGlobalError } = useGlobalError();

  watch(
    globalError,
    (error) => {
      if (!error) return;

      if (error.type === GLOBAL_ERROR_TYPES.ROSTERING_ENDED) {
        if (route.name !== APP_ROUTE_NAMES.ACCESS_ENDED) {
          router.replace({ name: APP_ROUTE_NAMES.ACCESS_ENDED });
        }
        return;
      }

      if (error.type === GLOBAL_ERROR_TYPES.AUTH_EXPIRED) {
        // Clear before redirecting — mirrors the router guard — so the guard
        // doesn't bounce the user back to Sign-In after a successful sign-in.
        clearGlobalError();
        if (route.name !== APP_ROUTE_NAMES.SIGN_IN) {
          router.replace({ name: APP_ROUTE_NAMES.SIGN_IN });
        }
        return;
      }

      // SERVER_ERROR and anything unrecognized land on the generic error page.
      if (route.name !== APP_ROUTE_NAMES.GENERIC_ERROR) {
        router.replace({ name: APP_ROUTE_NAMES.GENERIC_ERROR });
      }
    },
    // Cover an error set before this component's setup ran.
    { immediate: true },
  );
}

export default useGlobalErrorRedirect;
