<script setup>
import { useRouter } from 'vue-router';
import PvButton from 'primevue/button';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import { useGlobalError } from '@/composables/useGlobalError';

const router = useRouter();
const { clearGlobalError } = useGlobalError();
const { mutate: signOut } = useSignOutMutation();

function handleTryAgain() {
  clearGlobalError();
  router.push('/');
}

function handleSignOut() {
  clearGlobalError();
  signOut();
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
      <PvButton label="Try Again" @click="handleTryAgain" />
      <PvButton label="Sign Out" outlined @click="handleSignOut" />
    </div>
  </div>
</template>
