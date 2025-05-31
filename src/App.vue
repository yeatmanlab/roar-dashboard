<template>
  <Head>
    <title>Levante - {{ pageTitle }}</title>
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
  <div v-if="isAuthStoreReady">
    <PvToast position="bottom-center" />
    <NavBar v-if="typeof $route.name === 'string' && !navbarBlacklist.includes($route.name)" />
    <router-view :key="$route.fullPath" />

    <SessionTimer v-if="loadSessionTimeoutHandler" />
  </div>
  <div v-else>
    <LevanteSpinner fullscreen />
  </div>

  <VueQueryDevtools v-if="showDevtools" />
</template>

<script setup>
import { computed, onBeforeMount, onMounted, ref, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { Head } from '@unhead/vue/components';
import PvToast from 'primevue/toast';
import NavBar from '@/components/NavBar.vue';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import { i18n } from '@/translations/i18n';
import LevanteSpinner from '@/components/LevanteSpinner.vue';

const SessionTimer = defineAsyncComponent(() => import('@/containers/SessionTimer/SessionTimer.vue'));
const VueQueryDevtools = defineAsyncComponent(() =>
  import('@tanstack/vue-query-devtools').then((module) => module.VueQueryDevtools),
);

const isAuthStoreReady = ref(false);
const showDevtools = ref(false);

const authStore = useAuthStore();
const route = useRoute();

const pageTitle = computed(() => {
  const locale = i18n.global.locale.value;
  const fallbackLocale = i18n.global.fallbackLocale.value;
  const titles = route.meta?.pageTitle;

  if (typeof titles === 'object' && titles !== null) {
    const localeTitle = titles[locale];
    const fallbackTitle = titles[fallbackLocale];
    if (typeof localeTitle === 'string') return localeTitle;
    if (typeof fallbackTitle === 'string') return fallbackTitle;
  }
  if (typeof titles === 'string') {
    return titles;
  }
  return 'Levante';
});

const loadSessionTimeoutHandler = computed(() => isAuthStoreReady.value && authStore.isAuthenticated);

const navbarBlacklist = ref(['SignIn', 'Register', 'Maintenance', 'PlayApp', 'SWR', 'SRE', 'PA']);

onBeforeMount(async () => {
  await authStore.initFirekit();

  await authStore.initStateFromRedirect().then(async () => {
    // @TODO: Refactor this callback as we should ideally use the useUserClaimsQuery and useUserDataQuery composables.
    // @NOTE: Whilst the rest of the application relies on the user's ROAR UID, this callback requires the user's ID
    // in order for SSO to work and cannot currently be changed without significant refactoring.
    if (authStore.uid) {
      const userClaims = await fetchDocById('userClaims', authStore.uid);
      authStore.setUserClaims(userClaims);
    }
    if (authStore.roarUid) {
      const userData = await fetchDocById('users', authStore.roarUid);
      authStore.setUserData(userData);
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
