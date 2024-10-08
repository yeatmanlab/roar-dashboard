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
  </Head>

  <div>
    <PvToast />
    <NavBar v-if="!navbarBlacklist.includes($route.name) && isAuthStoreReady" />
    <router-view :key="$route.fullPath" />

    <SessionTimer v-if="loadSessionTimeoutHandler" />
  </div>
</template>

<script setup>
import { computed, onBeforeMount, ref, defineAsyncComponent, onUpdated } from 'vue';
import { useRoute } from 'vue-router';
import { useRecaptchaProvider } from 'vue-recaptcha';
import { Head } from '@unhead/vue/components';

import NavBar from '@/components/NavBar.vue';

const SessionTimer = defineAsyncComponent(() => import('@/containers/SessionTimer/SessionTimer.vue'));

import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import { i18n } from '@/translations/i18n';

const isLevante = import.meta.env.MODE === 'LEVANTE';
const isAuthStoreReady = ref(false);

const authStore = useAuthStore();
const route = useRoute();

const pageTitle = computed(() => {
  const locale = i18n.global.locale.value;
  const fallbackLocale = i18n.global.fallbackLocale.value;
  return route.meta?.pageTitle?.[locale] || route.meta?.pageTitle?.[fallbackLocale] || route.meta?.pageTitle;
});

const loadSessionTimeoutHandler = computed(() => isAuthStoreReady.value && authStore.isAuthenticated);

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

onUpdated(async () => {
  await authStore.updateTasksDictionary();
});

onBeforeMount(async () => {
  await authStore.initFirekit();
  authStore.setUser();
  await authStore.initStateFromRedirect().then(async () => {
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
</script>
