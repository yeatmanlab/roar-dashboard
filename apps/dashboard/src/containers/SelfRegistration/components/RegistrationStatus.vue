<template>
  <PvDialog
    :visible="Boolean(errorMessage || success)"
    :header="success ? 'Account created' : 'We could not create your account'"
    :style="{ width: 'min(25rem, calc(100vw - 2rem))' }"
    :modal="true"
    :draggable="false"
    @update:visible="dismiss"
  >
    <p role="status" aria-live="polite">
      {{ success ? 'Your account has been created. Redirecting to your dashboard…' : errorMessage }}
    </p>
    <PvButton v-if="errorMessage" label="Close" @click="dismiss" />
  </PvDialog>
</template>

<script setup>
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';

defineProps({
  errorMessage: { type: String, default: '' },
  success: { type: Boolean, default: false },
});

const emit = defineEmits(['dismiss']);

function dismiss(visible = false) {
  if (!visible) emit('dismiss');
}
</script>
