<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useGlobalError } from '@/composables/useGlobalError';

const router = useRouter();
const authStore = useAuthStore();
const { clearGlobalError } = useGlobalError();

function handleTryAgain() {
  clearGlobalError();
  router.push('/');
}

async function handleSignOut() {
  clearGlobalError();
  await authStore.signOut();
  router.push('/signin');
}
</script>

<template>
  <div class="flex flex-column align-items-center justify-content-center min-h-screen p-4">
    <i class="pi pi-exclamation-triangle text-6xl text-yellow-500 mb-4" aria-label="Error" />
    <h1 class="text-2xl font-bold mb-2">Something Went Wrong</h1>
    <p class="text-center text-gray-600 mb-4 max-w-30rem">
      An unexpected error occurred. Please try again, or sign out and sign back in.
    </p>
    <div class="flex gap-3">
      <button class="p-button" @click="handleTryAgain">Try Again</button>
      <button class="p-button p-button-outlined" @click="handleSignOut">Sign Out</button>
    </div>
  </div>
</template>
