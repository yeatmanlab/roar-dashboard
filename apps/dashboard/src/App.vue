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

    <router-view :key="$route.fullPath" />

    <SessionTimer v-if="loadSessionTimeoutHandler" />
  </div>

  <VueQueryDevtools v-if="showDevtools" />
</template>

<script setup>
import { computed, onBeforeMount, onMounted, ref, watch, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { useRecaptchaProvider } from 'vue-recaptcha';
import { Head } from '@unhead/vue/components';
import PvToast from 'primevue/toast';
import Navigation from '@/containers/Navigation/Navigation.vue';

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

const isAuthStoreReady = ref(false);
const showDevtools = ref(false);

const authStore = useAuthStore();
const route = useRoute();

const pageTitle = computed(() => {
  const locale = i18n.global.locale.value;
  const fallbackLocale = i18n.global.fallbackLocale.value;
  return route.meta?.pageTitle?.[locale] || route.meta?.pageTitle?.[fallbackLocale] || route.meta?.pageTitle;
});

const loadSessionTimeoutHandler = computed(() => isAuthStoreReady.value && authStore.isAuthenticated);

useRecaptchaProvider();

// Enable `/me` only once the auth store reports an access token. The query
// composable internally retries on transient failures and skips retry for
// rostering-ended / terminal auth errors (see `useMeQuery.js`). Wire the
// access-token check through `useMeQuery`'s own `enabled` knob so the query
// composable controls all its conditional-enable logic (mirroring every
// other query in `composables/queries/`).
const { data: meData, error: meError } = useMeQuery({
  enabled: computed(() => Boolean(authStore.accessToken)),
});

// Push the resolved `/me` payload into the auth store so consumers can read it
// via `storeToRefs(authStore).meData` / the `hasUnsignedTos` / `currentUserId`
// getters. Done via watcher rather than `onSuccess` so the store stays in sync
// across `/me` refetches (e.g., after the TOS-signing mutation invalidates it).
//
// A successful refetch after a prior failure also clears any stale
// `globalError` set by the error watcher below — without this, a transient
// 500 followed by a successful retry would leave the user stuck on
// `GenericError` because the router's global-error guard would keep firing.
const { setGlobalError, clearGlobalError } = useGlobalError();
watch(meData, (data) => {
  if (data) {
    authStore.setMeData(data);
    clearGlobalError();
  }
});

// Translate `/me` failures into the global error state. The router's
// `beforeEach` guard then redirects to the appropriate error page
// (AccessEnded / SignIn / GenericError).
watch(meError, (err) => {
  if (!err) return;
  if (isRosteringEndedError(err)) {
    setGlobalError({ type: 'rostering-ended' });
  } else if (isTerminalAuthError(err)) {
    setGlobalError({ type: 'auth-expired' });
  } else {
    setGlobalError({ type: 'server-error' });
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
    // consumers. The `useMeQuery` composable (above) populates the canonical `meData` field in parallel
    // — new consumers should read from `meData`. Legacy consumers will migrate incrementally.
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
