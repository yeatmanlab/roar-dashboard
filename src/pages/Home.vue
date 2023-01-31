<template>
  <div>
    <div v-if="authStore.homepageReady">
    </div>
    <AppSpinner v-else />
  </div>
</template>

<script setup>
import { useAuthStore } from "@/store/auth";

const authStore = useAuthStore();
</script>

<style scoped>
</style>
