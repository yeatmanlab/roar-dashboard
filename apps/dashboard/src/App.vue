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
import { i18n } from '@/translations/i18n';
import useMeQuery from '@/composables/queries/useMeQuery';
import { useGlobalError } from '@/composables/useGlobalError';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { APP_ROUTE_NAMES } from '@/constants/routes';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';

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

// `useMeQuery` is internally gated on `authStore.accessToken`, so no
// caller-side `enabled` is needed here. The composable also handles retry
// (3x on transient failures, skip on rostering-ended / terminal auth).
//
// `/me` data lives in TanStack Query — consumers read it via
// `useCurrentUser` (or `queryClient.getQueryData([ME_QUERY_KEY])` from
// non-component code). Nothing copies it into the auth store any more.
const { data: meData, error: meError, isFetching: isMeFetching } = useMeQuery();

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

// Watch the `/me` payload for two boot-time side effects that the router
// can't handle on its own:
//
//   1. Clear any stale `globalError` left over from a prior failed fetch.
//      A transient 500 followed by a successful retry would otherwise leave
//      the user stuck on GenericError because the router's global-error
//      guard would keep firing.
//   2. Push the user to SignTos if the resolved payload has unsigned
//      agreements and they're sitting on a non-SignTos route. `/me`
//      typically resolves *after* the router has already navigated, so the
//      `beforeEach` TOS guard doesn't fire on the initial render — this
//      watcher closes that boot-time gap. Subsequent navigations are
//      handled by the guard, which reads the same cached payload via the
//      queryClient.
const { setGlobalError, clearGlobalError } = useGlobalError();
watch(meData, (data) => {
  if (!data) return;
  clearGlobalError();

  const hasUnsignedTos = (data.unsignedAgreements?.length ?? 0) > 0;
  if (hasUnsignedTos && route.name !== APP_ROUTE_NAMES.SIGN_TOS && route.name !== APP_ROUTE_NAMES.SIGN_IN) {
    router.replace({ name: APP_ROUTE_NAMES.SIGN_TOS, query: { next: route.fullPath } });
  }
});

// Translate `/me` failures into the global error state and navigate to the
// matching error page. The router's `beforeEach` guard handles subsequent
// transitions, but `/me` typically resolves *after* the initial route is
// rendered — without an explicit `router.replace()` here, the user would see
// the requested page briefly before any later navigation triggered the guard.
watch(meError, (err) => {
  if (!err) return;
  if (isRosteringEndedError(err)) {
    setGlobalError({ type: GLOBAL_ERROR_TYPES.ROSTERING_ENDED });
    if (route.name !== APP_ROUTE_NAMES.ACCESS_ENDED) {
      router.replace({ name: APP_ROUTE_NAMES.ACCESS_ENDED });
    }
  } else if (isTerminalAuthError(err)) {
    setGlobalError({ type: GLOBAL_ERROR_TYPES.AUTH_EXPIRED });
    if (route.name !== APP_ROUTE_NAMES.SIGN_IN) {
      router.replace({ name: APP_ROUTE_NAMES.SIGN_IN });
    }
  } else {
    setGlobalError({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
    if (route.name !== APP_ROUTE_NAMES.GENERIC_ERROR) {
      router.replace({ name: APP_ROUTE_NAMES.GENERIC_ERROR });
    }
  }
});

onBeforeMount(async () => {
  await authStore.initFirekit();

  await authStore.initStateFromRedirect().then(async () => {
    // @TODO: Refactor this callback as we should ideally use the useUserClaimsQuery and useUserDataQuery composables.
    // @NOTE: Whilst the rest of the application relies on the user's ROAR UID, this callback requires the user's ID
    // in order for SSO to work and cannot currently be changed without significant refactoring.
    //
    // The Firestore-based fetches below populate legacy `userData` / `userClaims` fields for existing
    // consumers. The `useMeQuery` composable (above) is the canonical source for the authenticated
    // user — new consumers should read from `useCurrentUser` (which wraps it). Legacy consumers
    // will migrate incrementally.
    if (authStore.uid) {
      const userClaims = await fetchDocById('userClaims', authStore.uid);
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
