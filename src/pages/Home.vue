<template>
  <div v-if="authStore.isAuthenticated">
    <QueryRuns v-if="authStore.canRead" />
    <RequestPermission v-else />
  </div>
  <div v-else class="col-full text-center">
    <p>You are not yet logged in. Click below to log in.</p>
    <router-link :to="{ name: 'SignIn' }">
      <Button label="Log In" icon="pi pi-sign-in" />
    </router-link>
  </div>
</template>

<script setup>
import { useAuthStore } from "@/store/auth";
import QueryRuns from '@/components/QueryRuns.vue';
import RequestPermission from '@/components/RequestPermission.vue';

const authStore = useAuthStore();
</script>

<style scoped>
</style>
