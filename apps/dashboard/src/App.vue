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
    <div v-if="isMeSettling" class="flex flex-column align-items-center justify-content-center min-h-screen-minus-nav">
      <!-- margin: 0 overrides the spinner's own 100px top offset, which fights flex centering -->
      <AppSpinner style="margin: 0" />
    </div>
    <router-view v-else :key="$route.fullPath" />

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
import AppSpinner from '@/components/AppSpinner.vue';

const SessionTimer = defineAsyncComponent(() => import('@/containers/SessionTimer/SessionTimer.vue'));
const VueQueryDevtools = defineAsyncComponent(() =>
  import('@tanstack/vue-query-devtools').then((module) => module.VueQueryDevtools),
);

import { useAuthStore } from '@/store/auth';
import { createAuthService } from '@/services/AuthService';
import { resolveUserClaims } from '@/helpers/resolveUserClaims';
import { i18n } from '@/translations/i18n';
import useCurrentUser from '@/composables/useCurrentUser';
import { useGlobalError } from '@/composables/useGlobalError';
import { useGlobalErrorRedirect } from '@/composables/useGlobalErrorRedirect';
import { GLOBAL_ERROR_TYPES } from '@/constants/globalErrorTypes';

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
 *
 * Routes flagged `meta.awaitsUserProvisioning` (the SSO landing page) are
 * exempt: right after an SSO redirect, `/me` legitimately fails with
 * `auth/user-not-found` until the backend has provisioned the user, and
 * `useMeQuery` retries through that window patiently. The page renders its
 * own provisioning UX for that wait — holding it behind this gate would
 * show a bare spinner instead and keep its retry/error UI from ever
 * mounting.
 */
const isMeSettling = computed(
  () =>
    !route.meta.awaitsUserProvisioning &&
    Boolean(authStore.accessToken) &&
    isMeFetching.value &&
    !meData.value &&
    !meError.value,
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
const { setGlobalError, clearGlobalError } = useGlobalError();
watch(meData, (data) => {
  if (!data) return;
  clearGlobalError();
});

// Redirect whenever `globalError` is set outside a navigation. The router's
// `beforeEach` guard only reads `globalError` when a navigation is already
// happening, so errors that land on a settled route — `/me` resolving after
// the first navigation completed, a Firekit init failure during bootstrap, a
// background query escalated by the QueryCache bridge — need this watcher to
// reach their error page at all.
//
// All `setGlobalError` mapping lives in `queryClient.js`'s `QueryCache`
// `onError` hook — this watcher does not classify errors, it only navigates.
useGlobalErrorRedirect();

onBeforeMount(async () => {
  try {
    // 1. Create the AuthService singleton — owns Firebase Auth directly.
    createAuthService({
      projectId: import.meta.env.VITE_FIREBASE_ADMIN_PROJECT_ID,
      apiKey: import.meta.env.VITE_FIREBASE_ADMIN_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_ADMIN_AUTH_DOMAIN,
      emulatorAuthHost: import.meta.env.VITE_FIREBASE_EMULATOR_AUTH_HOST || undefined,
    });

    // 2. Initialize Auth (Firebase app + emulator + token listener).
    await authStore.initAuth();

    // 3. Initialize Firekit for non-auth operations (Firestore, assessments).
    await authStore.initFirekit();

    // 4. Check for pending SSO redirect results.
    await authStore.initStateFromRedirect().then(() => {
      // Claims are derived from the backend `/me` response on all builds (see
      // `resolveUserClaims`) and copied onto the auth store for the legacy
      // consumers that still read `authStore.userClaims` (`useUserType`,
      // `usePermissions`, the `roarUid` getter). The `useMeQuery` composable
      // (above) is the canonical source for the authenticated user — new
      // consumers should read from `useCurrentUser` (which wraps it). The
      // remaining `authStore.userData` consumers are tracked in #2219.
      //
      // The chain is deliberately NOT awaited: claims populate the store copy
      // asynchronously, and app readiness must not wait on `/me` retries (up
      // to ~7s of backoff on transient failures). Error surfacing is tracked
      // in #2205.
      if (authStore.uid) {
        const uidAtStart = authStore.uid;
        resolveUserClaims()
          .then((userClaims) => {
            // The user may have switched while the fetch was in flight; a
            // stale write would undo the listener's identity reset.
            if (authStore.uid !== uidAtStart) return;
            authStore.userClaims = userClaims;
          })
          .catch((error) => {
            console.error('[App] failed to resolve user claims from /me', error);
          });
      }
    });

    isAuthStoreReady.value = true;
  } catch (error) {
    // `initFirekit` and `initStateFromRedirect` catch internally, so this
    // boundary guards the steps with none of their own — `createAuthService`
    // and `initAuth` (missing Firebase config, persistence setup, emulator
    // init). Without it a rejection escapes the lifecycle hook: no error
    // page, no readiness, an app stuck on whatever painted first.
    //
    // `isAuthStoreReady` intentionally stays false — it only gates the
    // session timer, and a session that never bootstrapped has nothing to
    // time out. Sentry captures this via captureConsoleIntegration.
    console.error('[App] auth bootstrap failed', error);
    setGlobalError({ type: GLOBAL_ERROR_TYPES.SERVER_ERROR });
  }
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
