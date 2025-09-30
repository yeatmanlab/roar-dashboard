<template>
  <AppSpinner />
</template>
<script setup>
import { watch } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

const router = useRouter();
const authStore = useAuthStore();
const { isFirekitInit } = storeToRefs(authStore);

watch(isFirekitInit, async () => {
  if (isFirekitInit.value) {
    try {
      await authStore.roarfirekit.signInFromRedirectResult();
      router.replace({ name: 'Home' });
    } catch (error) {
      console.error('Failed to complete NYCPS auth:', error);
      router.push({ name: 'SignIn' });
    }
  }
});
</script>
