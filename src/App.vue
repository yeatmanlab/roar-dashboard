<template>
  <Head>
    <title>{{ isLevante ? '' : 'ROAR:' }} {{ pageTitle }}</title>
    <meta name="description" content="A web-based tool to query ROAR assessment data!" />

    <!-- Social -->
    <meta property="og:title" content="ROAR Web Query" />
    <meta property="og:description" content="A web-based tool to query ROAR assessment data!" />

    <!-- Twitter -->
    <meta name="twitter:title" content="ROAR Web Query" />
    <meta name="twitter:description" content="A web-based tool to query ROAR assessment data!" />

    <!-- Dynamic Favicon -->
    <link rel="icon" :href="`/favicon-${project}.ico`" />
  </Head>
  <div>
    <PvToast />
    <NavBar v-if="!navbarBlacklist.includes($route.name) && isAuthStoreReady" />
    <router-view :key="$route.fullPath" />

    <SessionTimer v-if="loadSessionTimeoutHandler" />
  </div>

  <VueQueryDevtools v-if="showDevtools" />
</template>

<script setup>
import { computed, onBeforeMount, onMounted, ref, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { useRecaptchaProvider } from 'vue-recaptcha';
import { Head } from '@unhead/vue/components';
import NavBar from '@/components/NavBar.vue';

const SessionTimer = defineAsyncComponent(() => import('@/containers/SessionTimer/SessionTimer.vue'));
const VueQueryDevtools = defineAsyncComponent(() =>
  import('@tanstack/vue-query-devtools').then((module) => module.VueQueryDevtools),
);

import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import { i18n } from '@/translations/i18n';
import { isLevante } from '@/helpers';

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
const project = computed(() => isLevante ? 'levante' : 'roar');

useRecaptchaProvider();

const navbarBlacklist = ref([
  'SignIn',
  'Register',
  'Maintenance',
  'PlayApp',
  'SWR',
  'SWR-ES',
  'SRE',
  'SRE-ES',
  'PA',
  'PA-ES',
  'Letter',
  'Letter-ES',
  'Vocab',
  'Multichoice',
  'Morphology',
  'Cva',
  'Fluency-ARF',
  'Fluency-ARF-ES',
  'Fluency-CALF',
  'Fluency-CALF-ES',
  'Fluency-Alpaca',
  'Fluency-Alpaca-ES',
  'RAN',
  'Crowding',
  'MEP',
]);

onBeforeMount(async () => {
  await authStore.initFirekit();

  await authStore.initStateFromRedirect().then(async () => {
    // @TODO: Refactor this callback as we should ideally use the useUserClaimsQuery and useUserDataQuery composables.
    // @NOTE: Whilst the rest of the application relies on the user's ROAR UID, this callback requires the user's ID
    // in order for SSO to work and cannot currently be changed without significant refactoring.
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
