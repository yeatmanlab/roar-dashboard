<template>
  <AppHead>
    <title>ROAR Web Query</title>
    <meta name="description" content="A web-based tool to query ROAR assessment data!">

    <!-- Social -->
    <meta property="og:title" content="ROAR Web Query">
    <meta property="og:description" content="A web-based tool to query ROAR assessment data!">

    <!-- Twitter -->
    <meta name="twitter:title" content="ROAR Web Query">
    <meta name="twitter:description" content="A web-based tool to query ROAR assessment data!">
  </AppHead>
  <Navbar />
  <router-view />
  <!-- <AppSpinner v-show="!showPage" /> -->
</template>

<script setup>
import { onMounted } from 'vue';
import Navbar from "@/components/Navbar.vue";
import { useAuthStore } from "@/store/auth";

onMounted(async () => {
  const authStore = useAuthStore();
  await authStore.initStateFromRedirect();
});
</script>
