<template>
  <AppHead>
    <title>ROAR: {{ $route.meta.pageTitle }}</title>
    <meta name="description" content="A web-based tool to query ROAR assessment data!">

    <!-- Social -->
    <meta property="og:title" content="ROAR Web Query">
    <meta property="og:description" content="A web-based tool to query ROAR assessment data!">

    <!-- Twitter -->
    <meta name="twitter:title" content="ROAR Web Query">
    <meta name="twitter:description" content="A web-based tool to query ROAR assessment data!">
  </AppHead>
  <div>
    <Toast />
    <Navbar v-if="!navbarBlacklist.includes($route.name)" />
    <router-view :key="$route.fullPath" />
  </div>

  <!-- <AppSpinner v-show="!showPage" /> -->
</template>

<script setup>
import { onBeforeMount } from 'vue';
import Navbar from "@/components/Navbar.vue";
import { useAuthStore } from "@/store/auth";
import { ref } from 'vue';
import { fetchDocById } from "@/helpers/query/utils";

const navbarBlacklist = ref([
  "SignIn",
  "PlayApp",
  "SWR",
  "SWR-ES",
  "SRE",
  "PA",
  "Letter",
  "Multichoice"
]);

onBeforeMount(async () => {
  const authStore = useAuthStore();
  await authStore.initFirekit();
  authStore.setUser();
  await authStore.initStateFromRedirect().then(async () => {
    if (authStore.uid) {
      const userData = await fetchDocById('users', authStore.uid);
      const userClaims = await fetchDocById('userClaims', authStore.uid);
      authStore.userData = userData
      authStore.userClaims = userClaims
    }
  });
});

</script>