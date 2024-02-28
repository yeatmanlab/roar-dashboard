<template>
  <AppHead>
    <title>ROAR: {{ pageTitle }}</title>
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
    <NavBar v-if="!navbarBlacklist.includes($route.name)" />
    <router-view :key="$route.fullPath" />
  </div>

  <!-- <AppSpinner v-show="!showPage" /> -->
</template>

<script setup>
import { computed, onBeforeMount } from 'vue';
import NavBar from '@/components/NavBar.vue';
import { useAuthStore } from '@/store/auth';
import { ref } from 'vue';
import { fetchDocById } from '@/helpers/query/utils';
import AppHead from '@/components/AppHead.vue';
import { i18n } from '@/translations/i18n';
import { useRoute } from 'vue-router';

const route = useRoute();
const pageTitle = computed(() => {
  return route.meta?.pageTitle?.[i18n.global.locale.value] ?? route.meta?.pageTitle?.[i18n.global.fallbackLocale.value];
});

const navbarBlacklist = ref([
  'SignIn',
  'PlayApp',
  'SWR',
  'SWR-ES',
  'SRE',
  'PA',
  'Letter',
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
});
</script>
