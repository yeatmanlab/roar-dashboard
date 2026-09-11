<script setup>
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import PvButton from 'primevue/button';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import { useGlobalError } from '@/composables/useGlobalError';
import { ME_QUERY_KEY } from '@/constants/queryKeys';

const router = useRouter();
const queryClient = useQueryClient();
const { clearGlobalError } = useGlobalError();
const { mutate: signOut } = useSignOutMutation();

/**
 * Clear the global error, invalidate the cached `/me` query so it refetches
 * (which is the actual "try again" the user expects — the server-error
 * branch in `App.vue` is driven by the `/me` query's error state), then
 * navigate home. If `/me` succeeds on the retry, the watcher in `App.vue`
 * proceeds normally; if it fails again, the watcher re-sets the global
 * error and the router guard sends the user back here.
 */
function handleTryAgain() {
  clearGlobalError();
  queryClient.invalidateQueries({ queryKey: [ME_QUERY_KEY] });
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
