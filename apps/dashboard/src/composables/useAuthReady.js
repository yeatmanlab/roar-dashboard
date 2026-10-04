import { onMounted, onUnmounted, readonly, ref } from 'vue';
import { useAuthStore } from '@/store/auth';

/**
 * Readiness gate for components that must wait for auth before enabling their
 * backend-client queries.
 *
 * Replaces the ad-hoc triad that was copied across ~20 components: a local
 * `initialized` ref, an `authStore.$subscribe` that flips it when
 * `accessToken` lands, and an `onMounted` fallback for the already-ready case.
 * The subscribe leaked (several call sites never unsubscribed) and fired on
 * every unrelated store mutation. This composable owns the subscription,
 * unsubscribes on first readiness, and tears down on unmount.
 *
 * Readiness tracks `authStore.isAuthReady` (a captured Firebase ID token),
 * which is the only condition the backend-client queries need — they
 * authenticate off the Bearer token. Call sites that previously gated on
 * firekit internals (`roarfirekit.updateUserData`, `restConfig?.()`,
 * `createUpdateUser`) migrate here too: those gates can never open on deployed
 * builds, and the token is the correct readiness signal regardless. The
 * underlying data paths migrate off firekit per-domain (tracked in #2219);
 * only the readiness gate changes here.
 *
 * @returns {{ ready: import('vue').Ref<boolean> }} A readonly ref that becomes
 *   true once auth is ready and stays true. Pass it as a query's `enabled`.
 */
export function useAuthReady() {
  const authStore = useAuthStore();
  const ready = ref(false);

  let unsubscribe;

  const markReady = () => {
    if (ready.value) return;
    ready.value = true;
    // Readiness is monotonic — once a token has been captured the gate stays
    // open, so the subscription has nothing left to watch for.
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = undefined;
    }
  };

  // Subscribe before the mounted check so the token's arrival can't slip
  // through the gap between the two. `$subscribe` fires on every store
  // mutation; markReady's monotonic guard makes the extra calls no-ops.
  unsubscribe = authStore.$subscribe((_mutation, state) => {
    if (state.accessToken) markReady();
  });

  onMounted(() => {
    // The token may already be present when this component mounts (a reload
    // with a restored session, or a navigation after sign-in). The subscribe
    // above only sees future mutations, so cover the already-ready case here.
    if (authStore.isAuthReady) markReady();
  });

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = undefined;
    }
  });

  return { ready: readonly(ready) };
}

export default useAuthReady;
