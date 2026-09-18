<template>
  <div
    v-if="loading"
    class="self-registration-status self-registration-status--loading flex flex-column text-center justify-content-center align-content-center"
    role="status"
    aria-live="polite"
  >
    <AppSpinner class="mb-3" />
    <span>{{ t('pageRegister.creatingYourAccount') }}</span>
  </div>

  <PvDialog
    v-else
    :visible="Boolean(errorMessage || success)"
    :header="success ? t('pageRegister.accountCreated') : t('pageRegister.createErrorTitle')"
    :style="{ width: 'min(25rem, calc(100vw - 2rem))' }"
    :modal="true"
    :draggable="false"
    @update:visible="dismiss"
  >
    <p role="status" aria-live="polite">
      {{ success ? t('pageRegister.accountCreatedMessage') : errorMessage }}
    </p>
    <PvButton v-if="errorMessage" :label="t('pageRegister.close')" @click="dismiss" />
  </PvDialog>
</template>

<script setup>
import AppSpinner from '@/components/AppSpinner.vue';
import PvButton from 'primevue/button';
import PvDialog from 'primevue/dialog';
import { i18n } from '@/translations/i18n';

defineProps({
  loading: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  success: { type: Boolean, default: false },
});

const { t } = i18n.global;

const emit = defineEmits(['dismiss']);

function dismiss(visible = false) {
  if (!visible) emit('dismiss');
}
</script>

<style scoped>
.self-registration-status {
  min-height: 12rem;
}
</style>
