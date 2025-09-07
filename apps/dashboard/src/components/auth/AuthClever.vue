<template>
  <AppSpinner />
</template>
<script setup>
import { watch } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';

const props = defineProps({
  code: { type: String, required: true },
  initiate: { type: Boolean, default: false },
});

const router = useRouter();
const authStore = useAuthStore();
const { isFirekitInit } = storeToRefs(authStore);

watch(isFirekitInit, () => {
  if (props.code || props.initiate) {
    authStore.cleverOAuthRequested = true;
    router.replace({ name: 'SignIn' });
  } else {
    router.push({ name: 'Home' });
  }
});
</script>
