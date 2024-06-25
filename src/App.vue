<template>
  <AppHead>
    <title>{{ isLevante ? '' : 'ROAR:' }} {{ pageTitle }}</title>
    <meta name="description" content="A web-based tool to query ROAR assessment data!" />

    <!-- Social -->
    <meta property="og:title" content="ROAR Web Query" />
    <meta property="og:description" content="A web-based tool to query ROAR assessment data!" />

    <!-- Twitter -->
    <meta name="twitter:title" content="ROAR Web Query" />
    <meta name="twitter:description" content="A web-based tool to query ROAR assessment data!" />
  </AppHead>
  <div>
    <PvToast />
    <NavBar v-if="!navbarBlacklist.includes($route.name) && isAuthStoreReady" />
    <router-view :key="$route.fullPath" />
  </div>
</template>

<script setup>
import { computed, onBeforeMount, ref } from 'vue';
import NavBar from '@/components/NavBar.vue';
import { useAuthStore } from '@/store/auth';
import { fetchDocById } from '@/helpers/query/utils';
import AppHead from '@/components/AppHead.vue';
import { i18n } from '@/translations/i18n';
import { useRoute } from 'vue-router';
import { useRecaptchaProvider } from 'vue-recaptcha';

const isLevante = import.meta.env.MODE === 'LEVANTE';
const route = useRoute();
const pageTitle = computed(() => {
  const locale = i18n.global.locale.value;
  const fallbackLocale = i18n.global.fallbackLocale.value;
  return route.meta?.pageTitle?.[locale] || route.meta?.pageTitle?.[fallbackLocale] || route.meta?.pageTitle;
});
const isAuthStoreReady = ref(false);

useRecaptchaProvider();

const navbarBlacklist = ref([
  'SignIn',
  'Register',
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
  const authStore = useAuthStore();
  await authStore.initFirekit();
  authStore.setUser();
  await authStore.initStateFromRedirect().then(async () => {
    if (authStore.uid) {
      const userData = await fetchDocById('users', authStore.uid);
      const userClaims = await fetchDocById('userClaims', authStore.uid);
      authStore.userData = userData;
      authStore.userClaims = userClaims;
    }
  });
  isAuthStoreReady.value = true;
});
</script>
