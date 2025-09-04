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

watch(isFirekitInit, () => {
  authStore.classLinkOAuthRequested = true;
  router.replace({ name: 'SignIn' });
});
</script>
