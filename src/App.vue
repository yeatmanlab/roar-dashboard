<template>
  <Head>
    <title>{{ pageTitle }}</title>
    <meta name="description" content="The LEVANTE Platform" />

    <!-- Social -->
    <meta property="og:title" content="LEVANTE" />
    <meta property="og:description" content="The LEVANTE Platform" />

    <!-- Twitter -->
    <meta name="twitter:title" content="LEVANTE" />
    <meta name="twitter:description" content="The LEVANTE Platform" />

    <!-- Dynamic Favicon -->
    <link rel="icon" :href="`/favicon-levante.ico`" />
  </Head>
  <div v-if="isAuthStoreReady" class="app">
    <PvToast position="bottom-center" />

    <NavBar v-if="typeof $route.name === 'string' && !NAVBAR_BLACKLIST.includes($route.name)" />

    <router-view :key="$route.fullPath" />

    <SessionTimer v-if="loadSessionTimeoutHandler" />
  </div>
  <div v-else data-cy="app-initializing">
    <LevanteSpinner fullscreen />
  </div>

  <VueQueryDevtools v-if="showDevtools" />
</template>

<script setup>
import { computed, onBeforeMount, onMounted, ref, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Head } from '@unhead/vue/components';
import PvToast from 'primevue/toast';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import { i18n, getTranslations, getLanguages } from '@/translations/i18n';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
import NavBar from '@/components/NavBar.vue';
import { NAVBAR_BLACKLIST } from './constants';
import { usePageEventTracking } from '@/composables/usePageEventTracking';
import { allowedUnauthenticatedRoutes } from '@/constants/auth';
import { useI18n } from 'vue-i18n';
import { slk } from 'survey-core';

const SessionTimer = defineAsyncComponent(() => import('@/containers/SessionTimer/SessionTimer.vue'));
const VueQueryDevtools = defineAsyncComponent(() =>
  import('@tanstack/vue-query-devtools').then((module) => module.VueQueryDevtools),
);

const isAuthStoreReady = ref(false);
const showDevtools = ref(false);

const authStore = useAuthStore();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

async function recoverFromProfileFetchFailure(error) {
  console.error('Error fetching user claims or user data', error);
  try {
    if (authStore.isFirekitInit()) {
      await authStore.signOut();
    }
  } catch (signOutError) {
    console.error('Error signing out after profile fetch failure', signOutError);
  }
  authStore.$reset();
  await authStore.initFirekit();
  await router.replace({ name: 'SignIn' });
}

const loadSessionTimeoutHandler = computed(() => {
  if (!authStore.isAuthenticated()) return false;
  if (route.name && allowedUnauthenticatedRoutes.includes(route.name)) return false;
  return true;
});

// Initialize page event tracking for global analytics
usePageEventTracking();

const pageTitle = computed(() => {
  const prefix = 'Levante';
  const title = route.meta?.pageTitle;

  if (!title) return prefix;

  if (typeof title === 'string') return `${prefix} — ${title}`;

  const key = title.translationKey;
  return key && i18n.global.te(key) ? `${prefix} — ${t(key)}` : prefix;
});

onBeforeMount(async () => {
  await getLanguages();
  await getTranslations();

  await authStore.initFirekit();

  await authStore
    .initStateFromRedirect()
    .then(async () => {
      // @TODO: Refactor this callback as we should ideally use the useUserClaimsQuery and useUserDataQuery composables.
      // @NOTE: Whilst the rest of the application relies on the user's ROAR UID, this callback requires the user's ID
      // in order for SSO to work and cannot currently be changed without significant refactoring.
      const uid = authStore.getUserId();
      if (!uid) {
        return;
      }
      try {
        const [userClaims, userData] = await Promise.all([fetchDocById('userClaims', uid), fetchDocById('users', uid)]);
        authStore.setUserClaims(userClaims);
        authStore.setUserData(userData);
      } catch (error) {
        await recoverFromProfileFetchFailure(error);
      }
    })
    .catch((error) => {
      console.error('Error initializing auth store', error);
    });

  isAuthStoreReady.value = true;
});

onMounted(() => {
  const isLocal = import.meta.env.MODE === 'development';
  const isDevToolsEnabled = import.meta.env.VITE_QUERY_DEVTOOLS_ENABLED === 'true';

  slk(import.meta.env.VITE_SURVEYJS_LICENSE_KEY ?? '');

  if (isLocal) {
    showDevtools.value = true;
  } else if (isDevToolsEnabled) {
    window.toggleDevtools = () => {
      showDevtools.value = !showDevtools.value;
    };
  }
});
</script>
