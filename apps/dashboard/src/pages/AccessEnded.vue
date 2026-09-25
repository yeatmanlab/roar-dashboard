<script setup>
import PvButton from 'primevue/button';
import { AppMessageState, MESSAGE_STATE_TYPES } from '@/components/AppMessageState';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import { useGlobalError } from '@/composables/useGlobalError';

const { clearGlobalError } = useGlobalError();
const { mutate: signOut } = useSignOutMutation();

function handleSignOut() {
  clearGlobalError();
  signOut();
}
</script>

<template>
  <div class="flex flex-column align-items-center justify-content-center min-h-screen-minus-nav p-4">
    <AppMessageState
      :type="MESSAGE_STATE_TYPES.ERROR"
      title="Access Has Ended"
      message="Your access to this platform has ended. If you believe this is an error, please contact your administrator."
    >
      <template #actions>
        <PvButton label="Sign Out" outlined @click="handleSignOut" />
      </template>
    </AppMessageState>
  </div>
</template>
