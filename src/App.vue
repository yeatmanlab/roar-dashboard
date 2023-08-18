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
<<<<<<< HEAD
  <Navbar v-if="$route.name !== 'SignIn'" />
  <main id="main">
    <router-view />
  </main>  
=======
  <div>
    <Toast />
    <Navbar v-if="!navbarBlacklist.includes($route.name)" />
    <router-view />
  </div>

>>>>>>> main
  <!-- <AppSpinner v-show="!showPage" /> -->
</template>

<script setup>
import { onBeforeMount } from 'vue';
import Navbar from "@/components/Navbar.vue";
import { useAuthStore } from "@/store/auth";
import { ref } from 'vue';

const navbarBlacklist = ref([
  "SignIn",
  "PlayApp",
  "SWR",
  "SRE",
  "PA"
]);

onBeforeMount(async () => {
  const authStore = useAuthStore();
  await authStore.initFirekit();
  authStore.setUser();
  // await authStore.initStateFromRedirect();
});

</script>
