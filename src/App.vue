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
  <the-navbar />
  <router-view />
  <!-- <AppSpinner v-show="!showPage" /> -->
</template>

<script setup>
import { onMounted } from 'vue';
import TheNavbar from "@/components/TheNavbar.vue";
import { useAuthStore } from "@/store/auth";


onMounted(async () => {
  const authStore = useAuthStore();
  await authStore.initStateFromRedirect();
});
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
