<template>
  <PvDialog
    v-model:visible="visible"
    modal
    header="Important Notice: Password Synchronization Required"
    :style="{ width: '50vw' }"
    :closable="false"
  >
    <div class="p-4">
      <p class="mb-3">
        We have identified an issue affecting accounts that were registered via CSV upload. Some user accounts did not have passwords properly set during the registration process.
      </p>
      <p class="mb-3">
        To fix this issue, administrators need to re-sync passwords by uploading the original CSV file that was returned during registration.
      </p>
      <p class="mb-3">
        Under the "Users" section in the navbar, go to the "Sync Passwords" page to upload your CSV file and complete this process.
      </p>
      <p class="mb-4">
        Only accounts with missing passwords will be affected - existing passwords will not be changed.
      </p>
    </div>
    <template #footer>
      <div class="p-3 flex justify-content-end w-full">
        <PvButton
          label="OK"
          icon="pi pi-check"
          class="p-button-primary"
          @click="onConfirm"
          autofocus
          data-cy="resync-modal-confirm"
        />
      </div>
    </template>
  </PvDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Ref } from 'vue';
import PvDialog from 'primevue/dialog';
import PvButton from 'primevue/button';

const visible: Ref<boolean> = ref(true);
const emit = defineEmits<{ (e: 'confirm'): void }>();

const onConfirm = (): void => {
  visible.value = false;
  emit('confirm');
};
</script> 
