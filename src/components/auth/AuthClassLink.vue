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
});

const router = useRouter();
const authStore = useAuthStore();
const { isFirekitInit } = storeToRefs(authStore);

console.log('in AuthClassLink component');

watch(isFirekitInit, () => {
  if (props.code) {
    authStore.classLinkOAuthRequested = true;
    console.log('---> In auth-classlink, redirecting to sign-in page');
    router.replace({ name: 'SignIn' });
  } else {
    router.push({ name: 'Home' });
    console.log('---> In auth-classlink, redirecting to home page');
  }
});
</script>
