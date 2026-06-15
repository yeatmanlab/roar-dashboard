<template>
  <Head>
    <title>ROAR: {{ pageTitle }}</title>
    <meta name="description" content="The Rapid Online Assessment of Reading" />

    <!-- Social -->
    <meta property="og:title" content="ROAR Web Query" />
    <meta property="og:description" content="A web-based tool to query ROAR assessment data!" />

    <!-- Twitter -->
    <meta name="twitter:title" content="ROAR Web Query" />
    <meta name="twitter:description" content="A web-based tool to query ROAR assessment data!" />
  </Head>

  <div>
    <PvToast />

    <Navigation />

    <!--
      Gate router-view on `/me` settlement. Once the user has an access
      token, useMeQuery is enabled; we hold the destination page back
      until the query has settled so the protected route doesn't paint
      with stale store values or before the TOS / error redirects below
      have a chance to fire. Unauthenticated routes (Sign-In, error
      pages) render immediately because `accessToken` is null, so
      `isMeSettling` is false.
    -->
    <AppSpinner v-if="isMeSettling" />
    <router-view v-else :key="$route.fullPath" />

    <SessionTimer v-if="loadSessionTimeoutHandler" />
  </div>

  <VueQueryDevtools v-if="showDevtools" />
</template>

<script setup>
import { computed, onBeforeMount, onMounted, ref, watch, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRecaptchaProvider } from 'vue-recaptcha';
import { Head } from '@unhead/vue/components';
import PvToast from 'primevue/toast';
import Navigation from '@/containers/Navigation/Navigation.vue';
import AppSpinner from '@/components/AppSpinner.vue';

const SessionTimer = defineAsyncComponent(() => import('@/containers/SessionTimer/SessionTimer.vue'));
const VueQueryDevtools = defineAsyncComponent(() =>
  import('@tanstack/vue-query-devtools').then((module) => module.VueQueryDevtools),
);

import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import { resolveUserClaims } from '@/helpers/resolveUserClaims';
import { i18n } from '@/translations/i18n';
import useCurrentUser from '@/composables/useCurrentUser';
import { useGlobalError } from '@/composables/useGlobalError';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { APP_ROUTE_NAMES } from '@/constants/routes';

const isAuthStoreReady = ref(false);
const showDevtools = ref(false);

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const pageTitle = computed(() => {
  const locale = i18n.global.locale.value;
  const fallbackLocale = i18n.global.fallbackLocale.value;
  return route.meta?.pageTitle?.[locale] || route.meta?.pageTitle?.[fallbackLocale] || route.meta?.pageTitle;
});

const loadSessionTimeoutHandler = computed(() => isAuthStoreReady.value && authStore.isAuthenticated);

useRecaptchaProvider();

// `useCurrentUser` is the single read-path for the authenticated user across
// the dashboard — it wraps `useMeQuery`, which is internally gated on
// `authStore.accessToken` and handles retry (3x on transient failures, skip
// on rostering-ended / terminal auth).
//
// `/me` data lives in TanStack Query — consumers read it via
// `useCurrentUser` (or `queryClient.getQueryData([ME_QUERY_KEY])` from
// non-component code). Nothing copies it into the auth store any more.
const { data: meData, error: meError, isFetching: isMeFetching } = useCurrentUser();

/**
 * Hold back router-view until `/me` settles for authenticated users.
 *
 * Three states matter here:
 *   - No access token: useMeQuery is disabled; we render immediately so
 *     unauthenticated routes (Sign-In, error pages) paint without delay.
 *   - Access token present, /me still in flight (no data, no error yet):
 *     show a spinner so the destination page can't flash before any TOS /
 *     error redirects below get a chance to fire.
 *   - /me has resolved or errored: render the destination; the error
 *     watcher below has already issued any necessary redirect.
 */
const isMeSettling = computed(
  () => Boolean(authStore.accessToken) && isMeFetching.value && !meData.value && !meError.value,
);

// Clear any stale `globalError` left over from a prior failed fetch when
// `/me` resolves successfully. A transient 500 followed by a successful
// retry would otherwise leave the user stuck on GenericError because the
// router's global-error guard would keep firing.
//
// TOS routing is intentionally NOT handled here. The router's `beforeEach`
// guard (in `router/index.js`) is the single source of truth: it awaits
// `ensureQueryData([ME_QUERY_KEY])` on the initial navigation and reads the
// cached payload on subsequent navigations. Duplicating the redirect here
// produced a race where both surfaces tried to push to SignTos at once.
const { clearGlobalError } = useGlobalError();
watch(meData, (data) => {
  if (!data) return;
  clearGlobalError();
});

// Translate `/me` failures into a `router.replace()` so the user lands on
// the matching error page without first flashing the route they originally
// requested. The router's `beforeEach` guard handles subsequent transitions
// once `globalError` is set; this watcher exists only to cover the boot
// window where `/me` resolves *after* the first navigation has already
// completed.
//
// All `setGlobalError` mapping lives in `queryClient.js`'s `QueryCache`
// `onError` hook — this watcher does not touch global error state.
watch(meError, (err) => {
  if (!err) return;
  if (isRosteringEndedError(err)) {
    if (route.name !== APP_ROUTE_NAMES.ACCESS_ENDED) {
      router.replace({ name: APP_ROUTE_NAMES.ACCESS_ENDED });
    }
  } else if (isTerminalAuthError(err)) {
    if (route.name !== APP_ROUTE_NAMES.SIGN_IN) {
      router.replace({ name: APP_ROUTE_NAMES.SIGN_IN });
    }
  } else if (route.name !== APP_ROUTE_NAMES.GENERIC_ERROR) {
    router.replace({ name: APP_ROUTE_NAMES.GENERIC_ERROR });
  }
});

onBeforeMount(async () => {
  await authStore.initFirekit();

  await authStore.initStateFromRedirect().then(async () => {
    // TODO(post-/me): retire once useUserClaimsQuery is migrated; see frontend migration plan.
    //
    // The Firestore-based fetches below populate the legacy `userData` /
    // `userClaims` fields on the auth store for existing consumers. The
    // `useMeQuery` composable (above) is the canonical source for the
    // authenticated user — new consumers should read from `useCurrentUser`
    // (which wraps it). Legacy consumers (`useUserType`, `usePermissions`,
    // and the components that still read `authStore.userData` directly)
    // will migrate incrementally as their ts-rest equivalents land.
    //
    // Out of scope for this PR: the SSO flow still needs the Firestore user
    // ID at this point, so deleting the fetches here would break sign-in
    // before the migration is complete.
    if (authStore.uid) {
      // Emulator mode derives super_admin from /me; production reads Firestore.
      const userClaims = await resolveUserClaims(authStore.uid);
      authStore.userClaims = userClaims;
    }
    if (authStore.roarUid) {
      const userData = await fetchDocById('users', authStore.roarUid);
      authStore.userData = userData;
    }
  });

  isAuthStoreReady.value = true;
});

onMounted(() => {
  const isLocal = import.meta.env.MODE === 'development';
  const isDevToolsEnabled = import.meta.env.VITE_QUERY_DEVTOOLS_ENABLED === 'true';

  if (isLocal) {
    showDevtools.value = true;
  } else if (isDevToolsEnabled) {
    window.toggleDevtools = () => {
      showDevtools.value = !showDevtools.value;
    };
  }
});
</script>
