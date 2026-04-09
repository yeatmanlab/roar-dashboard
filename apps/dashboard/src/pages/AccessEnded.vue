<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useGlobalError } from '@/composables/useGlobalError';

const router = useRouter();
const authStore = useAuthStore();
const { clearGlobalError } = useGlobalError();

async function handleSignOut() {
  clearGlobalError();
  await authStore.signOut();
  router.push('/signin');
}
</script>

<template>
  <div class="flex flex-column align-items-center justify-content-center min-h-screen p-4">
    <i class="pi pi-lock text-6xl text-red-500 mb-4" aria-label="Access denied" />
    <h1 class="text-2xl font-bold mb-2">Access Has Ended</h1>
    <p class="text-center text-gray-600 mb-4 max-w-30rem">
      Your access to this platform has ended. If you believe this is an error, please contact your administrator.
    </p>
    <button class="p-button p-button-outlined" @click="handleSignOut">Sign Out</button>
  </div>
</template>
